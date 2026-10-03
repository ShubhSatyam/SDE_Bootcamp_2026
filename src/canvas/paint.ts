import type { Stroke } from '../types/strokes';

export type InkBounds = { left: number; top: number; right: number; bottom: number };

export function getInkBounds(strokes: Stroke[]): InkBounds | null {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (points.length === 0) return null;
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

export function paintStrokes(context: CanvasRenderingContext2D, strokes: Stroke[]): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.globalCompositeOperation = stroke.mode === 'pixel-eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = '#273b34';
    context.fillStyle = '#273b34';
    context.lineWidth = stroke.mode === 'pixel-eraser' ? stroke.width * 3 : stroke.width;
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    else {
      for (let index = 1; index < stroke.points.length; index += 1) {
        context.lineTo(stroke.points[index].x, stroke.points[index].y);
      }
    }
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
}

export function renderCanvas(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  answer: string,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  paintStrokes(context, strokes);

  const bounds = getInkBounds(strokes);
  if (!bounds || !answer) return;
  const fontSize = 27;
  context.font = `600 ${fontSize}px "Segoe Print", "Comic Sans MS", cursive`;
  context.textBaseline = 'alphabetic';
  const measured = context.measureText(answer).width;
  const left = Math.min(bounds.right + 16, Math.max(12, width - measured - 16));
  const baseline = Math.min(height - 18, Math.max(40, bounds.bottom + 2));
  context.fillStyle = answer === 'Invalid expression' ? '#a36a55' : '#bd6646';
  context.fillText(answer, left, baseline);
}
