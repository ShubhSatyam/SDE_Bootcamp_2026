export type Point = { x: number; y: number; pressure?: number };

export type Stroke = {
  id: number;
  points: Point[];
  width: number;
  mode: 'pen' | 'pixel-eraser';
};

export type Tool = 'pen' | 'stroke-eraser' | 'pixel-eraser';

export type RecognitionState =
  | { status: 'idle' | 'loading' | 'recognizing' | 'ready'; expression: string; result: string }
  | { status: 'error'; expression: string; result: string; message: string };
