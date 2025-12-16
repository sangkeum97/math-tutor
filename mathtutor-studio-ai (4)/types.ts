export enum ToolType {
  PEN = 'PEN',
  HIGHLIGHTER = 'HIGHLIGHTER',
  ERASER = 'ERASER',
  SELECT = 'SELECT',
  HAND = 'HAND',
  LASER = 'LASER'
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
  tool: ToolType;
  opacity: number;
  isShape?: boolean; // True if this path was auto-corrected to a shape
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  isError?: boolean;
}

export interface CanvasState {
  paths: DrawingPath[];
  currentPath: DrawingPath | null;
  backgroundImage: HTMLImageElement | null;
  scale: number;
  offset: Point;
}

export type GeminiLiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PageData {
  id: string; // Unique page ID
  originalPageNum: number; // 1-based index from the file source
  thumbnail: string; // Base64 thumbnail
  recognizedPageNum?: string | null; // AI-detected page number
  paths?: DrawingPath[]; // Persisted handwriting data
}

export interface AppDocument {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  pages: PageData[];
  isExpanded: boolean;
  pdfProxy?: any; // pdfjs-dist DocumentProxy
  rawFile?: File; // To keep reference if needed
}

// Collaboration Types
export type SyncMessageType = 'DRAW_STROKE' | 'CLEAR_BOARD' | 'SET_BACKGROUND' | 'SYNC_STATE';

export interface SyncMessage {
  type: SyncMessageType;
  payload?: any;
}