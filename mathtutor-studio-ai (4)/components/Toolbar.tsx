import React, { useState, useRef, useEffect } from 'react';
import { ToolType } from '../types';
import { AVAILABLE_COLORS } from '../constants';
import { Pencil, Eraser, Highlighter, Trash2, Upload, Hand, Undo2, MousePointer2, Download, Circle, ChevronRight, ChevronLeft, Palette } from 'lucide-react';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (t: ToolType) => void;
  currentColor: string;
  setColor: (c: string) => void;
  currentWidth: number;
  setWidth: (w: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  canPrevPage: boolean;
  canNextPage: boolean;
}

const WIDTHS = [2, 4, 8, 12];

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setTool,
  currentColor,
  setColor,
  currentWidth,
  setWidth,
  onClear,
  onUndo,
  onUpload,
  onDownload,
  onPrevPage,
  onNextPage,
  canPrevPage,
  canNextPage,
}) => {
  const [activePopover, setActivePopover] = useState<'width' | 'color' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePopover = (type: 'width' | 'color') => {
    setActivePopover(prev => prev === type ? null : type);
  };

  const ToolButton = ({ 
    active, 
    onClick, 
    icon: Icon, 
    title,
    color
  }: { 
    active: boolean; 
    onClick: () => void; 
    icon: any; 
    title: string;
    color?: string;
  }) => (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl transition-all relative group ${
        active
          ? (color ? color : 'bg-indigo-600 text-white shadow-md shadow-indigo-200')
          : 'text-slate-500 hover:bg-slate-100'
      }`}
      title={title}
    >
      <Icon size={20} />
    </button>
  );

  return (
    <div 
      ref={containerRef}
      className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-white/95 backdrop-blur-sm p-2 rounded-2xl shadow-xl border border-slate-200 z-50 select-none"
    >
      {/* Tools Group */}
      <div className="flex flex-col gap-1">
        <ToolButton 
            active={currentTool === ToolType.HAND} 
            onClick={() => setTool(ToolType.HAND)} 
            icon={Hand} 
            title="Pan (Move Board)" 
        />
        <ToolButton 
            active={currentTool === ToolType.PEN} 
            onClick={() => setTool(ToolType.PEN)} 
            icon={Pencil} 
            title="Pen" 
        />
        <ToolButton 
            active={currentTool === ToolType.HIGHLIGHTER} 
            onClick={() => setTool(ToolType.HIGHLIGHTER)} 
            icon={Highlighter} 
            title="Highlighter" 
        />
        <ToolButton 
            active={currentTool === ToolType.LASER} 
            onClick={() => setTool(ToolType.LASER)} 
            icon={MousePointer2} 
            title="Laser Pointer" 
            color="bg-red-600 text-white shadow-md shadow-red-200"
        />
        <ToolButton 
            active={currentTool === ToolType.ERASER} 
            onClick={() => setTool(ToolType.ERASER)} 
            icon={Eraser} 
            title="Stroke Eraser" 
        />
      </div>

      <div className="w-full h-px bg-slate-100 my-1" />

      {/* Properties Group (Popovers) */}
      <div className="flex flex-col gap-2 items-center relative">
        
        {/* Width Trigger */}
        <div className="relative">
            <button
                onClick={() => togglePopover('width')}
                className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center relative"
                title="Stroke Width"
            >
                <div 
                    className="rounded-full bg-slate-800"
                    style={{ width: Math.max(6, currentWidth * 1.2), height: Math.max(6, currentWidth * 1.2) }}
                />
                {activePopover === 'width' && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2">
                        {/* Popover Content */}
                    </div>
                )}
            </button>
            
            {/* Width Popover Menu */}
            {activePopover === 'width' && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-white p-2 rounded-xl shadow-xl border border-slate-200 flex flex-col gap-2 min-w-[3rem] items-center animate-in fade-in slide-in-from-left-2 duration-200">
                    {WIDTHS.map((w) => (
                        <button
                            key={w}
                            onClick={() => { setWidth(w); setActivePopover(null); }}
                            className={`p-2 rounded-lg hover:bg-slate-50 w-full flex justify-center items-center ${currentWidth === w ? 'bg-indigo-50' : ''}`}
                        >
                             <div 
                                className={`rounded-full ${currentWidth === w ? 'bg-indigo-600' : 'bg-slate-400'}`}
                                style={{ width: Math.max(6, w * 1.5), height: Math.max(6, w * 1.5) }}
                             />
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Color Trigger */}
        <div className="relative">
             <button
                onClick={() => togglePopover('color')}
                className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center"
                title="Color Palette"
            >
                <div 
                    className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: currentColor }}
                />
            </button>

            {/* Color Popover Menu */}
            {activePopover === 'color' && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-white p-2 rounded-xl shadow-xl border border-slate-200 grid grid-cols-2 gap-2 w-24 animate-in fade-in slide-in-from-left-2 duration-200">
                    {AVAILABLE_COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => { setColor(c); setActivePopover(null); }}
                            className={`w-8 h-8 rounded-full border-2 transition-transform ${
                                currentColor === c ? 'border-slate-600 scale-110' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            )}
        </div>

      </div>

      <div className="w-full h-px bg-slate-100 my-1" />

      {/* Actions Group */}
      <div className="flex flex-col gap-1">
        {/* Page Navigation */}
        <div className="flex flex-col gap-1 pb-1 mb-1 border-b border-slate-100">
           <button 
             onClick={onPrevPage} 
             disabled={!canPrevPage}
             className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
             title="Previous Page"
           >
              <ChevronLeft size={20} />
           </button>
           <button 
             onClick={onNextPage} 
             disabled={!canNextPage}
             className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
             title="Next Page"
           >
              <ChevronRight size={20} />
           </button>
        </div>

        <label className="cursor-pointer p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex justify-center" title="Upload Image or PDF">
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onUpload} />
          <Upload size={20} />
        </label>
        
        <button
          onClick={onDownload}
          className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
          title="Download Page"
        >
          <Download size={20} />
        </button>

        <button
          onClick={onUndo}
          className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
          title="Undo"
        >
          <Undo2 size={20} />
        </button>

        <button
          onClick={onClear}
          className="p-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Clear Board"
        >
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;