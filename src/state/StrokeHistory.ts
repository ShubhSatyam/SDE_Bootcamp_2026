import type { Stroke } from '../types/strokes';

export class StrokeHistory {
  private snapshots: Stroke[][];
  private position = 0;

  constructor(initial: Stroke[] = [], private readonly limit = 100) {
    this.snapshots = [initial];
  }

  get current(): Stroke[] {
    return this.snapshots[this.position];
  }

  get canUndo(): boolean {
    return this.position > 0;
  }

  get canRedo(): boolean {
    return this.position < this.snapshots.length - 1;
  }

  commit(strokes: Stroke[]): Stroke[] {
    this.snapshots = this.snapshots.slice(0, this.position + 1);
    this.snapshots.push(strokes);
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
