import { describe, expect, it } from 'vitest';
import { getHandwritingFontSize } from './paint';
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
});
