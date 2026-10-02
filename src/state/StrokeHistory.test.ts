import { describe, expect, it } from 'vitest';
import { StrokeHistory } from './StrokeHistory';
import type { Stroke } from '../types/strokes';

const stroke = (id: number): Stroke => ({ id, points: [{ x: id, y: 1 }], width: 3, mode: 'pen' });

describe('StrokeHistory', () => {
  it('undoes and redoes snapshots, dropping the redo branch after an edit', () => {
    const history = new StrokeHistory();
    history.commit([stroke(1)]);
    history.commit([stroke(1), stroke(2)]);
    expect(history.undo()).toHaveLength(1);
    expect(history.redo()).toHaveLength(2);
    history.undo();
    history.commit([stroke(3)]);
    expect(history.canRedo).toBe(false);
    expect(history.current[0].id).toBe(3);
  });

  it('bounds retained undo snapshots', () => {
    const history = new StrokeHistory([], 2);
    history.commit([stroke(1)]);
    history.commit([stroke(2)]);
    history.commit([stroke(3)]);
    expect(history.undo()[0].id).toBe(2);
    expect(history.undo()[0].id).toBe(1);
    expect(history.canUndo).toBe(false);
  });
});
