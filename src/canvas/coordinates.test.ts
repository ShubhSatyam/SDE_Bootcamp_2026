import { describe, expect, it } from 'vitest';
import { clientToCanvasPoint, getCanvasBackingSize } from './coordinates';

describe('canvas coordinate transforms', () => {
  it('converts client coordinates into logical CSS-pixel coordinates', () => {
    expect(clientToCanvasPoint(220, 145, { left: 100, top: 45 })).toEqual({ x: 120, y: 100 });
  });

  it('allocates a correctly scaled backing buffer for high-DPI displays', () => {
    expect(getCanvasBackingSize(320, 180, 2)).toEqual({ width: 640, height: 360, ratio: 2 });
    expect(getCanvasBackingSize(320, 180, 0.75)).toEqual({ width: 320, height: 180, ratio: 1 });
  });
});
