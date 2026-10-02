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

export async function makeRecognitionImage(strokes: Stroke[]): Promise<Blob | null> {
  const bounds = getInkBounds(strokes);
  if (!bounds) return null;
  const source = document.createElement('canvas');
  source.width = 384;
  source.height = 384;
  const context = source.getContext('2d');
  if (!context) throw new Error('Could not create recognition image');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, source.width, source.height);

  const margin = 22;
  const contentWidth = Math.max(1, bounds.right - bounds.left + margin * 2);
  const contentHeight = Math.max(1, bounds.bottom - bounds.top + margin * 2);
  const scale = Math.min((source.width - 2 * margin) / contentWidth, (source.height - 2 * margin) / contentHeight);
  const offsetX = (source.width - contentWidth * scale) / 2 - (bounds.left - margin) * scale;
  const offsetY = (source.height - contentHeight * scale) / 2 - (bounds.top - margin) * scale;
  context.save();
  context.translate(offsetX, offsetY);
  context.scale(scale, scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = stroke.mode === 'pixel-eraser' ? '#ffffff' : '#171717';
    context.fillStyle = context.strokeStyle;
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
  context.restore();
  return new Promise((resolve, reject) => {
    source.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode recognition image'));
    }, 'image/png');
  });
}
