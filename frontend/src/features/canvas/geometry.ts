import type { Point, Stroke } from '../../types/strokes';

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

export function isPointNearStroke(point: Point, stroke: Stroke, radius: number): boolean {
  if (stroke.points.length === 0) return false;
  if (stroke.points.length === 1) {
    return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= radius + stroke.width / 2;
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= radius + stroke.width / 2) return true;
  }
  return false;
}
