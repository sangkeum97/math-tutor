import { ToolType } from './types';

export const DEFAULT_STROKE_WIDTH = 3;
export const ERASER_WIDTH = 20;
export const HIGHLIGHTER_OPACITY = 0.3;
export const PEN_OPACITY = 1;

export const AVAILABLE_COLORS = [
  '#000000', // Black
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
];

export const MODEL_FLASH = 'gemini-2.5-flash';
export const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Helper to get stroke style based on tool
export const getStrokeStyle = (tool: ToolType, color: string) => {
  switch (tool) {
    case ToolType.HIGHLIGHTER:
      return { color, opacity: HIGHLIGHTER_OPACITY, composite: 'multiply' as GlobalCompositeOperation };
    case ToolType.ERASER:
      return { color: '#ffffff', opacity: 1, composite: 'destination-out' as GlobalCompositeOperation };
    default:
      return { color, opacity: PEN_OPACITY, composite: 'source-over' as GlobalCompositeOperation };
  }
};
