import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { configureCanvasSize, clientToCanvasPoint } from './coordinates';
import { isPointNearStroke } from './geometry';
import { renderCanvas } from './paint';
import type { Point, Stroke, Tool } from '../types/strokes';

type Props = {
  strokes: Stroke[];
  answer: string;
  recognizedExpression: string;
  tool: Tool;
  strokeWidth: number;
  onCommit: (strokes: Stroke[]) => void;
};

export function DrawingCanvas({ strokes, answer, recognizedExpression, tool, strokeWidth, onCommit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>();
  const activePointerRef = useRef<number>();
  const workingStrokesRef = useRef(strokes);
  const currentStrokeRef = useRef<Stroke>();
  const answerRef = useRef(answer);
  const changedRef = useRef(false);

  const requestDraw = useCallback(() => {
    if (frameRef.current !== undefined) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      if (canvasRef.current) renderCanvas(canvasRef.current, workingStrokesRef.current, answerRef.current);
    });
  }, []);

  useEffect(() => {
    workingStrokesRef.current = strokes;
    requestDraw();
  }, [strokes, requestDraw]);

  useEffect(() => {
    answerRef.current = answer;
    requestDraw();
  }, [answer, requestDraw]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      configureCanvasSize(canvas, bounds.width, bounds.height, window.devicePixelRatio || 1);
      requestDraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [requestDraw]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const point = clientToCanvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    return event.pressure > 0 ? { ...point, pressure: event.pressure } : point;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== undefined || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    changedRef.current = false;
    const point = pointFromEvent(event);
    if (tool === 'stroke-eraser') {
      const next = workingStrokesRef.current.filter((stroke) => !isPointNearStroke(point, stroke, strokeWidth * 2));
      changedRef.current = next.length !== workingStrokesRef.current.length;
      workingStrokesRef.current = next;
    } else {
      const stroke: Stroke = {
        id: Date.now() + Math.random(),
        points: [point],
        width: strokeWidth,
        mode: tool === 'pixel-eraser' ? 'pixel-eraser' : 'pen',
      };
      currentStrokeRef.current = stroke;
      workingStrokesRef.current = [...workingStrokesRef.current, stroke];
      changedRef.current = true;
    }
    requestDraw();
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    for (const sample of samples) {
      const point = clientToCanvasPoint(sample.clientX, sample.clientY, event.currentTarget.getBoundingClientRect());
      if (tool === 'stroke-eraser') {
        const next = workingStrokesRef.current.filter((stroke) => !isPointNearStroke(point, stroke, strokeWidth * 2));
        if (next.length !== workingStrokesRef.current.length) {
          workingStrokesRef.current = next;
          changedRef.current = true;
        }
      } else if (currentStrokeRef.current) {
        const nextPoint = sample.pressure > 0 ? { ...point, pressure: sample.pressure } : point;
        currentStrokeRef.current.points.push(nextPoint);
      }
    }
    requestDraw();
  };

  const finishPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = undefined;
    currentStrokeRef.current = undefined;
    if (changedRef.current) onCommit([...workingStrokesRef.current]);
    changedRef.current = false;
  };

  return (
    <div ref={hostRef} className="paper" data-tool={tool}>
      <canvas
        ref={canvasRef}
        className="ink-layer"
        aria-label={recognizedExpression ? `Recognized expression ${recognizedExpression}. Answer: ${answer}` : 'Handwriting canvas'}
        role="img"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />
      {strokes.length === 0 && <div className="paper-hint">Start writing here<span>Try a calculation like 18 + 4 × 3 =</span></div>}
    </div>
  );
}
