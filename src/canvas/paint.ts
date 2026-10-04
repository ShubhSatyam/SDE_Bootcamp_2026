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
    const effectiveWidth = stroke.mode === 'pixel-eraser' ? stroke.width * 3 : stroke.width;
    context.lineWidth = effectiveWidth;

    if (stroke.points.length === 1) {
      context.beginPath();
      context.arc(stroke.points[0].x, stroke.points[0].y, effectiveWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else if (stroke.points.length === 2) {
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      context.lineTo(stroke.points[1].x, stroke.points[1].y);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let index = 1; index < stroke.points.length - 1; index += 1) {
        const p1 = stroke.points[index];
        const p2 = stroke.points[index + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        context.quadraticCurveTo(p1.x, p1.y, midX, midY);
      }
      const lastPoint = stroke.points[stroke.points.length - 1];
      context.lineTo(lastPoint.x, lastPoint.y);
      context.stroke();
    }
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
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || (canvas.width / dpr);
  const height = canvas.clientHeight || (canvas.height / dpr);

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  paintStrokes(context, strokes);

  const bounds = getInkBounds(strokes);
  if (bounds && answer) {
    const fontSize = 27;
    context.font = `600 ${fontSize}px "Segoe Print", "Comic Sans MS", cursive`;
    context.textBaseline = 'alphabetic';
    const measured = context.measureText(answer).width;
    const left = Math.min(bounds.right + 16, Math.max(12, width - measured - 16));
    const baseline = Math.min(height - 18, Math.max(40, bounds.bottom + 2));
    context.fillStyle = answer === 'Invalid expression' ? '#a36a55' : '#bd6646';
    context.fillText(answer, left, baseline);
  }
  context.restore();
}
