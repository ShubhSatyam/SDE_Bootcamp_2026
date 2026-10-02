import { describe, expect, it } from 'vitest';
import { isPointNearStroke } from './geometry';
import type { Stroke } from '../types/strokes';

const stroke: Stroke = {
  id: 1,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  width: 4,
  mode: 'pen',
};

describe('stroke geometry', () => {
  it('detects points near a line segment and rejects distant points', () => {
    expect(isPointNearStroke({ x: 50, y: 6 }, stroke, 4)).toBe(true);
    expect(isPointNearStroke({ x: 50, y: 12 }, stroke, 4)).toBe(false);
  });
});
