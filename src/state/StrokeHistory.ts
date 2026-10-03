import type { Point, Stroke } from '../types/strokes';

function clonePoint(point: Point): Point {
  return { ...point };
}

function cloneStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    points: stroke.points.map(clonePoint),
  };
}

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map(cloneStroke);
}

export class StrokeHistory {
  private snapshots: Stroke[][];
  private position = 0;

  constructor(initial: Stroke[] = [], private readonly limit = 100) {
    this.snapshots = [cloneStrokes(initial)];
  }

  get current(): Stroke[] {
    return cloneStrokes(this.snapshots[this.position]);
  }

  get canUndo(): boolean {
    return this.position > 0;
  }

  get canRedo(): boolean {
    return this.position < this.snapshots.length - 1;
  }

  commit(strokes: Stroke[]): Stroke[] {
    const snapshot = cloneStrokes(strokes);
    this.snapshots = this.snapshots.slice(0, this.position + 1);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.limit + 1) this.snapshots.shift();
    this.position = this.snapshots.length - 1;
    return this.current;
  }

  undo(): Stroke[] {
    if (this.canUndo) this.position -= 1;
    return this.current;
  }

  redo(): Stroke[] {
    if (this.canRedo) this.position += 1;
    return this.current;
  }
}
