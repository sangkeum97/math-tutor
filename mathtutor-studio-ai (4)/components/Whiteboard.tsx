import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { ToolType, Point, DrawingPath } from '../types';
import { getStrokeStyle } from '../constants';
import { isPointNearPath, recognizeShape } from '../utils/mathUtils';

interface WhiteboardProps {
  tool: ToolType;
  color: string;
  width: number;
  bgImage: HTMLImageElement | null;
  onPathComplete?: (path: DrawingPath) => void;
}

export interface WhiteboardHandle {
  getCanvasDataURL: () => string;
  getCanvasBlob: () => Promise<Blob | null>;
  undo: () => void;
  getPaths: () => DrawingPath[];
  setPaths: (paths: DrawingPath[]) => void;
  addPath: (path: DrawingPath) => void; // New method for syncing
}

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(({ tool, color, width, bgImage, onPathComplete }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const hasInitializedViewRef = useRef(false);
  const prevImageSrcRef = useRef<string | null>(null);
  
  // Interaction Refs
  const lastMousePosRef = useRef<Point | null>(null);
  const shapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dimensions state
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Helper to render the full resolution image for export
  const renderToExportCanvas = (): HTMLCanvasElement | null => {
      // Determine target dimensions (Original Image Size or Current Container Size)
      let targetWidth = size.width;
      let targetHeight = size.height;

      if (bgImage) {
          targetWidth = bgImage.naturalWidth;
          targetHeight = bgImage.naturalHeight;
      }

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = targetWidth;
      exportCanvas.height = targetHeight;
      const ctx = exportCanvas.getContext('2d');
      
      if (!ctx) return null;

      // 1. Draw Background
      if (bgImage) {
          ctx.drawImage(bgImage, 0, 0);
      } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // 2. Draw Paths (Scale 1:1 relative to world coordinates)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawPath = (path: DrawingPath) => {
          const style = getStrokeStyle(path.tool, path.color);
          ctx.beginPath();
          ctx.strokeStyle = style.color;
          // Note: path.width is in world coordinates, so it matches the image resolution automatically
          ctx.lineWidth = path.width; 
          ctx.globalAlpha = style.opacity;
          ctx.globalCompositeOperation = style.composite;

          if (path.points.length > 0) {
              ctx.moveTo(path.points[0].x, path.points[0].y);
              for (let i = 1; i < path.points.length; i++) {
                  ctx.lineTo(path.points[i].x, path.points[i].y);
              }
              if (path.isShape) {
                  ctx.closePath();
              }
          }
          ctx.stroke();
      };

      paths.forEach(drawPath);
      // We do not draw the 'currentPath' (cursor being dragged) during export usually, 
      // but if you wanted to, you could add it here.
      
      return exportCanvas;
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getCanvasDataURL: () => {
        const exportCanvas = renderToExportCanvas();
        if (!exportCanvas) return '';
        return exportCanvas.toDataURL('image/jpeg', 0.8);
    },
    getCanvasBlob: () => {
         return new Promise((resolve) => {
            const exportCanvas = renderToExportCanvas();
            if (!exportCanvas) {
                resolve(null);
                return;
            }
            exportCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
         });
    },
    undo: () => {
        setPaths(prev => prev.slice(0, -1));
    },
    getPaths: () => paths,
    setPaths: (newPaths: DrawingPath[]) => setPaths(newPaths),
    addPath: (newPath: DrawingPath) => setPaths(prev => [...prev, newPath])
  }));

  // Resize Observer
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Reset initialization flag ONLY when image source string changes
  useEffect(() => {
      // If src changed or we went from null to image (or vice versa)
      if (bgImage?.src !== prevImageSrcRef.current) {
          hasInitializedViewRef.current = false;
          prevImageSrcRef.current = bgImage?.src || null;
      }
  }, [bgImage]);

  // Center image only when we have a valid image and size, AND we haven't initialized yet for this image
  useEffect(() => {
    if (bgImage && size.width > 0 && size.height > 0 && !hasInitializedViewRef.current) {
        const hRatio = size.width / bgImage.width;
        const vRatio = size.height / bgImage.height;
        // Fit contained
        const initialScale = Math.min(hRatio, vRatio) * 0.9;
        const centerX = (size.width - bgImage.width * initialScale) / 2;
        const centerY = (size.height - bgImage.height * initialScale) / 2;
        
        setScale(initialScale);
        setOffset({ x: centerX, y: centerY });
        hasInitializedViewRef.current = true;
    }
  }, [bgImage, size.width, size.height]);

  useEffect(() => {
    if (canvasRef.current) {
        canvasRef.current.width = size.width;
        canvasRef.current.height = size.height;
        redrawAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, bgImage, paths, currentPath, scale, offset, cursorPos]);

  // --- Coordinate Helpers ---

  // Screen (Mouse) -> World (Canvas Logic)
  const toWorld = (screenPoint: Point): Point => {
      return {
          x: (screenPoint.x - offset.x) / scale,
          y: (screenPoint.y - offset.y) / scale
      };
  };

  const redrawAll = (hideCursor = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 1. Clear Screen
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to clear full screen
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Apply Transform (Zoom/Pan)
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

    // 3. Draw Background Image
    if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height);
    }

    // 4. Draw Paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawPath = (path: DrawingPath) => {
        const style = getStrokeStyle(path.tool, path.color);
        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = path.width;
        ctx.globalAlpha = style.opacity;
        ctx.globalCompositeOperation = style.composite;

        if (path.points.length > 0) {
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            if (path.isShape) {
                ctx.closePath();
            }
        }
        ctx.stroke();
    };

    paths.forEach(drawPath);
    if (currentPath) drawPath(currentPath);

    // 5. Draw Laser/Cursor (if applicable)
    if (!hideCursor && cursorPos && tool === ToolType.LASER) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        
        const { x, y } = cursorPos; // These are world coordinates
        
        // Glow effect
        const gradient = ctx.createRadialGradient(x, y, 1, x, y, 20 / scale);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 20 / scale, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 3 / scale, 0, Math.PI * 2);
        ctx.fill();
    }
  };

  const getMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // --- Event Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomIntensity = 0.001;
    const delta = -e.deltaY * zoomIntensity;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 10); 

    const mousePos = getMousePos(e);
    const worldPos = {
        x: (mousePos.x - offset.x) / scale,
        y: (mousePos.y - offset.y) / scale
    };

    const newOffset = {
        x: mousePos.x - worldPos.x * newScale,
        y: mousePos.y - worldPos.y * newScale
    };

    setScale(newScale);
    setOffset(newOffset);
  };

  const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to stop scrolling/pull-to-refresh on mobile
    if (e.cancelable) e.preventDefault(); 
    
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);
    
    lastMousePosRef.current = screenPos;

    const isMiddleClick = 'button' in e && e.button === 1;

    if (tool === ToolType.HAND || isMiddleClick) {
        setIsPanning(true);
        return;
    }

    if (tool === ToolType.LASER) {
        setCursorPos(worldPos);
        setIsDrawing(true);
        return;
    }
    
    if (tool === ToolType.ERASER) {
        setIsDrawing(true);
        const worldThreshold = 10 / scale; 
        
        const newPaths = paths.filter(p => !isPointNearPath(worldPos, p, worldThreshold));
        if (newPaths.length !== paths.length) {
            setPaths(newPaths);
            // In a real sync scenario, we'd need to send the full path list or a delete ID
            // For now, simple stroke syncing is easier, complex syncing requires ID management for paths.
            // We will just let visual state sync.
        }
        return;
    }

    setIsDrawing(true);
    setCurrentPath({
      points: [worldPos],
      color: color,
      width: width, 
      tool: tool,
      opacity: tool === ToolType.HIGHLIGHTER ? 0.5 : 1
    });

    if (tool === ToolType.PEN || tool === ToolType.HIGHLIGHTER) {
        startShapeTimer();
    }
  };

  const moveInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to stop scrolling
    if (e.cancelable) e.preventDefault();

    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);
    
    if (isPanning && lastMousePosRef.current) {
        const dx = screenPos.x - lastMousePosRef.current.x;
        const dy = screenPos.y - lastMousePosRef.current.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMousePosRef.current = screenPos;
        return;
    }

    if (!isDrawing) {
        if (tool === ToolType.LASER) {
             setCursorPos(worldPos);
        }
        return;
    }
    
    if (tool === ToolType.LASER) {
        setCursorPos(worldPos);
        return;
    }
    
    if (tool === ToolType.ERASER) {
        const worldThreshold = 10 / scale;
        const newPaths = paths.filter(p => !isPointNearPath(worldPos, p, worldThreshold));
        if (newPaths.length !== paths.length) {
            setPaths(newPaths);
        }
        return;
    }

    if (!currentPath) return;

    if (tool === ToolType.PEN || tool === ToolType.HIGHLIGHTER) {
        startShapeTimer();
    }
    
    lastMousePosRef.current = screenPos;
    setCurrentPath(prev => prev ? ({
      ...prev,
      points: [...prev.points, worldPos]
    }) : null);
  };

  const endInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    
    if (isPanning) {
        setIsPanning(false);
    }
    
    if (tool === ToolType.LASER) {
        setIsDrawing(false);
        return;
    }

    if (isDrawing && currentPath) {
      let finalPath = currentPath;
      
      // If shape recognition ran and modified the path in state, we need that version?
      // Actually `currentPath` in scope is the last render's state.
      // We push what we have. If shape recognition triggers, it usually updates `currentPath` 
      // which triggers re-render.
      
      setPaths(prev => [...prev, finalPath]);
      
      // Notify Parent for Sync
      if (onPathComplete) {
          onPathComplete(finalPath);
      }
    }
    
    setCurrentPath(null);
    setIsDrawing(false);
    lastMousePosRef.current = null;
  };
  
  const handleMouseLeave = (e: React.MouseEvent) => {
      endInteraction(e);
      setCursorPos(null);
  };

  const startShapeTimer = () => {
      if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
      shapeTimerRef.current = setTimeout(() => {
          setCurrentPath(prev => {
              if (!prev || prev.points.length < 5) return prev;
              const correctedPoints = recognizeShape(prev.points);
              if (correctedPoints) {
                  return {
                      ...prev,
                      points: correctedPoints,
                      isShape: true
                  };
              }
              return prev;
          });
      }, 600);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-white touch-none">
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full ${
            tool === ToolType.HAND || isPanning 
                ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') 
                : tool === ToolType.LASER 
                    ? 'cursor-none'
                    : 'cursor-crosshair'
        }`}
        onMouseDown={startInteraction}
        onMouseMove={moveInteraction}
        onMouseUp={endInteraction}
        onMouseLeave={handleMouseLeave}
        onTouchStart={startInteraction}
        onTouchMove={moveInteraction}
        onTouchEnd={endInteraction}
        onWheel={handleWheel}
      />
    </div>
  );
});

export default Whiteboard;