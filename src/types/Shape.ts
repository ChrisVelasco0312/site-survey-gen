export type Tool = 'select' | 'eraser' | 'pencil' | 'square' | 'square-fill' | 'circle' | 'circle-fill';

export interface BaseShape {
  id: string;
  type: string;
  color: string;
  strokeWidth: number;
  rotation?: number; // radians
}

export interface RectShape extends BaseShape {
  type: 'square' | 'square-fill';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle' | 'circle-fill';
  x: number;
  y: number;
  radius: number;
}

export interface PencilShape extends BaseShape {
  type: 'pencil';
  points: { x: number; y: number }[];
}

export type Shape = RectShape | CircleShape | PencilShape;
