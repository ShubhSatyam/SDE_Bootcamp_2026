import { describe, expect, it } from 'vitest';
import { getAutoWriteAnswerFontSize, getHandwritingFontSize } from './paint';
import type { Stroke } from '../../types/strokes';

function stroke(top: number, bottom: number, width = 5, mode: Stroke['mode'] = 'pen'): Stroke {
  return {
    id: 1,
    width,
    mode,
    points: [{ x: 10, y: top }, { x: 20, y: bottom }],
  };
}

describe('handwriting-matched answer size', () => {
  it('uses measured glyph metrics to match the handwritten ink height', () => {
    expect(getHandwritingFontSize([stroke(20, 60)], 70, 240)).toBe(57);
    expect(getHandwritingFontSize([stroke(20, 100)], 70, 240)).toBe(107);
  });

  it('keeps the answer within the available canvas height', () => {
    expect(getHandwritingFontSize([stroke(20, 200)], 50, 120)).toBe(120);
  });

  it('ignores eraser marks when estimating handwriting size', () => {
    expect(getHandwritingFontSize([stroke(20, 60), stroke(0, 200, 10, 'pixel-eraser')], 70, 240)).toBe(57);
    expect(getHandwritingFontSize([], 70, 240)).toBe(27);
  });

  it('shrinks the auto-written answer until it fits inside the canvas width', () => {
    const context = {
      font: '',
      measureText(text: string) {
        const fontSize = Number.parseInt(this.font.match(/(\d+)px/)?.[1] ?? '0', 10);
        return { width: text.length * fontSize * 0.55 };
      },
    } as Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;

    const fontSize = getAutoWriteAnswerFontSize(context as CanvasRenderingContext2D, '123456789', 100, 120, 18, 'sans-serif', 400);
    expect(fontSize).toBeLessThan(120);
    expect(fontSize).toBeGreaterThanOrEqual(18);
    context.font = `400 ${fontSize}px sans-serif`;
    expect(context.measureText('123456789').width).toBeLessThanOrEqual(100);
  });
});
