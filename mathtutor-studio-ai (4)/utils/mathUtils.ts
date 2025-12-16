import { Point, DrawingPath } from '../types';

// Calculate distance between two points
export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Distance from a point to a line segment (v, w)
function distToSegment(p: Point, v: Point, w: Point) {
  const l2 = Math.pow(distance(v, w), 2);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return distance(p, projection);
}

// Ramer-Douglas-Peucker algorithm for polygon simplification
const simplifyPoints = (points: Point[], epsilon: number): Point[] => {
  if (points.length < 3) return points;

  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = distToSegment(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const res1 = simplifyPoints(points.slice(0, index + 1), epsilon);
    const res2 = simplifyPoints(points.slice(index), epsilon);
    return [...res1.slice(0, -1), ...res2];
  } else {
    return [points[0], points[end]];
  }
};

// Check if a point hits a path (Stroke Eraser logic)
export const isPointNearPath = (point: Point, path: DrawingPath, threshold: number = 5): boolean => {
  if (path.points.length < 2) return false;
  
  // Optimization: Bounding box check first
  const xs = path.points.map(p => p.x);
  const ys = path.points.map(p => p.y);
  const minX = Math.min(...xs) - threshold;
  const maxX = Math.max(...xs) + threshold;
  const minY = Math.min(...ys) - threshold;
  const maxY = Math.max(...ys) + threshold;

  if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
    return false;
  }

  // Detailed segment check
  for (let i = 0; i < path.points.length - 1; i++) {
    const d = distToSegment(point, path.points[i], path.points[i + 1]);
    if (d < threshold + path.width / 2) {
      return true;
    }
  }
  return false;
};

// Shape Recognition Logic
export const recognizeShape = (points: Point[]): Point[] | null => {
  if (points.length < 10) return null; // Require enough points for better accuracy

  const start = points[0];
  const end = points[points.length - 1];
  const totalLength = points.reduce((acc, p, i) => i > 0 ? acc + distance(points[i-1], p) : 0, 0);
  const directDistance = distance(start, end);

  // 1. Straight Line Check
  const isClosed = distance(start, end) < totalLength * 0.25; // Slightly relaxed closure check

  if (!isClosed) {
    // Check linearity
    if (totalLength < directDistance * 1.2) {
        return [start, end];
    }
    return null; 
  }

  // 2. Closed Shape Processing
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.sqrt(width * width + height * height);

  // Simplify the polygon
  // Epsilon factor affects how "smooth" the polygon becomes.
  const epsilon = diagonal * 0.05; 
  const simplified = simplifyPoints(points, epsilon);
  
  // RDP returns start and end as separate points even if closed.
  // We use n as the number of unique vertices (assuming start approx equals end)
  const n = simplified.length - 1;

  // Triangle
  if (n === 3) {
      return simplified.slice(0, 3);
  }

  // Quadrilateral (Rectangle / Square)
  // Users usually want clean rectangles for boxes.
  if (n === 4) {
      return [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY }
      ];
  }

  // 5 or more vertices: Could be a polygon (pentagon, hexagon) or a circle.
  if (n >= 5) {
      const center = { x: minX + width / 2, y: minY + height / 2 };
      
      // Calculate how much the points deviate from a perfect circle radius
      const dists = simplified.slice(0, n).map(p => distance(p, center));
      const avgDist = dists.reduce((a,b) => a+b, 0) / n;
      const variance = dists.reduce((a,b) => a + Math.pow(b - avgDist, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      
      // Coefficient of Variation (CV). Low CV means points are roughly equidistant from center => Circle.
      // High CV means irregular distances => Polygon.
      const cv = stdDev / avgDist;

      // If very circular (cv < 0.15), return Ellipse/Circle
      if (cv < 0.15) {
          const rx = width / 2;
          const ry = height / 2;
          const ellipsePoints: Point[] = [];
          const segments = 45;
          for (let i = 0; i <= segments; i++) {
              const angle = (i / segments) * Math.PI * 2;
              ellipsePoints.push({
                  x: center.x + rx * Math.cos(angle),
                  y: center.y + ry * Math.sin(angle)
              });
          }
          return ellipsePoints;
      } else {
          // It's a polygon (Pentagon, Hexagon, Star, etc.)
          // Return the simplified linear segments
          return simplified.slice(0, n);
      }
  }

  // Fallback for very complex shapes - return original smoothed or simplified
  return null;
};