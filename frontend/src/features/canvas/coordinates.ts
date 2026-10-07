import type { Point } from '../../types/strokes';

export type CanvasRect = Pick<DOMRect, 'left' | 'top'> & Partial<Pick<DOMRect, 'width' | 'height'>>;

export function getCanvasBackingSize(width: number, height: number, pixelRatio: number) {
  const ratio = Math.max(1, pixelRatio);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio), ratio };
}

export function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
  canvasWidth?: number,
  canvasHeight?: number,
): Point {
  let x = clientX - rect.left;
  let y = clientY - rect.top;
  if (canvasWidth && rect.width && rect.width > 0) {
    x = (x / rect.width) * canvasWidth;
  }
  if (canvasHeight && rect.height && rect.height > 0) {
    y = (y / rect.height) * canvasHeight;
  }
  return { x, y };
}

export function configureCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
): void {
  const backingSize = getCanvasBackingSize(width, height, pixelRatio);
  canvas.width = backingSize.width;
  canvas.height = backingSize.height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.setTransform(backingSize.ratio, 0, 0, backingSize.ratio, 0, 0);
}
