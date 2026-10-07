import type { Stroke } from '../../types/strokes';

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

export function getHandwritingFontSize(
  strokes: Stroke[],
  glyphHeightAt100Px: number,
  maxFontSize: number,
  scale = 0.88,
): number {
  const penStrokes = strokes.filter((stroke) => stroke.mode === 'pen' && stroke.points.length > 0);
  const bounds = getInkBounds(penStrokes);
  if (!bounds || glyphHeightAt100Px <= 0) return 27;

  const strokeWidth = penStrokes.map((stroke) => stroke.width).sort((a, b) => a - b)[Math.floor(penStrokes.length / 2)];
  const inkHeight = bounds.bottom - bounds.top + strokeWidth;
  return Math.max(18, Math.min(maxFontSize, Math.round(100 * inkHeight * scale / glyphHeightAt100Px)));
}

export function paintStrokes(context: CanvasRenderingContext2D, strokes: Stroke[], inkColor = '#273b34'): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.globalCompositeOperation = stroke.mode === 'pixel-eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = inkColor;
    context.fillStyle = inkColor;
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

export function getAutoWriteAnswerFontSize(
  context: CanvasRenderingContext2D,
  answer: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize = 18,
  fontFamily = 'system-ui, sans-serif',
  fontWeight = 400,
): number {
  let fontSize = maxFontSize;
  while (fontSize >= minFontSize) {
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (context.measureText(answer).width <= maxWidth) return fontSize;
    fontSize -= 2;
  }
  context.font = `${fontWeight} ${minFontSize}px ${fontFamily}`;
  return minFontSize;
}

export function renderCanvas(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  answer: string,
  answerMode: 'suggestion' | 'ink' = 'suggestion',
  themeInkColor?: string,
  autoWriteFontFamily = 'system-ui, sans-serif',
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  const inkColor = themeInkColor || getComputedStyle(canvas).color || '#273b34';
  paintStrokes(context, strokes, inkColor);

  const penStrokes = strokes.filter((stroke) => stroke.mode === 'pen' && stroke.points.length > 0);
  const bounds = getInkBounds(penStrokes);
  if (bounds && answer) {
    const noteExpression = canvas.ownerDocument.querySelector('.notepad-expression');
    const answerFont = getComputedStyle(noteExpression ?? canvas);
    const baseFontSize = answerMode === 'ink' ? 100 : 27;
    const fontFamily = answerMode === 'ink' ? autoWriteFontFamily : answerFont.fontFamily;
    const fontWeight = answerMode === 'ink' ? 400 : answerFont.fontWeight;
    const fontWeightValue = Number.parseInt(String(fontWeight), 10) || 400;
    context.font = `${fontWeightValue} ${baseFontSize}px ${fontFamily}`;
    const answerAtBaseSize = context.measureText(answer);
    const glyphHeight = answerAtBaseSize.actualBoundingBoxAscent + answerAtBaseSize.actualBoundingBoxDescent;
    const maxFontSize = Math.min(240, height * 0.8);
    const maxAnswerWidth = Math.max(60, width - 72);
    const fontSize = answerMode === 'ink'
      ? Math.min(
          getHandwritingFontSize(penStrokes, glyphHeight, maxFontSize),
          getAutoWriteAnswerFontSize(context, answer, maxAnswerWidth, maxFontSize, 18, fontFamily, fontWeightValue),
        )
      : 27;
    context.font = `${fontWeightValue} ${fontSize}px ${fontFamily}`;
    const metrics = context.measureText(answer);
    context.textBaseline = 'alphabetic';
    const measured = metrics.width;
    const paper = canvas.parentElement;
    const paperWidth = Math.max(width, measured + 88);
    if (paper && paper.clientWidth < paperWidth) {
      paper.style.width = `${paperWidth}px`;
      paper.style.minWidth = `${paperWidth}px`;
    }
    const strokeWidths = penStrokes.map((stroke) => stroke.width).sort((a, b) => a - b);
    const medianStrokeWidth = strokeWidths[Math.floor(strokeWidths.length / 2)] ?? 5;
    const inkRight = bounds.right + medianStrokeWidth / 2;
    const inkBottom = bounds.bottom + medianStrokeWidth / 2;
    const gap = answerMode === 'ink' ? Math.max(4, medianStrokeWidth * 1.2) : 16;
    const drawableWidth = Math.max(width, paper?.clientWidth ?? width);
    const left = Math.max(12, Math.min(inkRight + gap, drawableWidth - measured - 16));
    const baseline = answerMode === 'ink'
      ? Math.min(height - metrics.actualBoundingBoxDescent - 8, inkBottom - metrics.actualBoundingBoxDescent)
      : Math.min(height - 18, Math.max(40, bounds.bottom + 2));
    context.fillStyle = answerMode === 'ink'
      ? inkColor
      : answer === 'Invalid expression'
        ? '#a36a55'
        : '#bd6646';
    if (answerMode === 'ink') {
      const answerCanvas = canvas.ownerDocument.createElement('canvas');
      answerCanvas.width = canvas.width;
      answerCanvas.height = canvas.height;
      const answerContext = answerCanvas.getContext('2d');
      if (!answerContext) throw new Error('Could not create an offscreen canvas context to render the answer.');
      answerContext.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      answerContext.font = context.font;
      answerContext.textBaseline = 'alphabetic';
      answerContext.fillStyle = inkColor;
      answerContext.fillText(answer, left, baseline);
      answerContext.globalCompositeOperation = 'destination-out';
      answerContext.lineWidth = medianStrokeWidth;
      answerContext.lineJoin = 'round';
      answerContext.strokeText(answer, left, baseline);
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(answerCanvas, 0, 0);
      context.restore();
    } else {
      context.fillText(answer, left, baseline);
    }
  }
}
