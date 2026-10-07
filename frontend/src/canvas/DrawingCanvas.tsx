import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [paperSize, setPaperSize] = useState({ width: 0, height: 0 });

  const requestDraw = useCallback(() => {
    if (frameRef.current !== undefined) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      if (canvasRef.current) renderCanvas(canvasRef.current, workingStrokesRef.current, answerRef.current);
    });
  }, []);

  // Synchronously update and render canvas whenever strokes or answer change (Clear, Undo, Redo)
  useLayoutEffect(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    workingStrokesRef.current = strokes;
    answerRef.current = answer;
    activePointerRef.current = undefined;
    currentStrokeRef.current = undefined;
    changedRef.current = false;
    if (canvasRef.current) {
      renderCanvas(canvasRef.current, strokes, answer);
    }
  }, [strokes, answer]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      setPaperSize({ width: bounds.width, height: bounds.height });
      if (bounds.width > 0 && bounds.height > 0) {
        configureCanvasSize(canvas, bounds.width, bounds.height, window.devicePixelRatio || 1);
        if (canvasRef.current) renderCanvas(canvasRef.current, workingStrokesRef.current, answerRef.current);
      }
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

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (activePointerRef.current !== undefined) {
        activePointerRef.current = undefined;
        currentStrokeRef.current = undefined;
        if (changedRef.current) {
          onCommit([...workingStrokesRef.current]);
          changedRef.current = false;
        }
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [onCommit]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    const rect = canvas ? canvas.getBoundingClientRect() : event.currentTarget.getBoundingClientRect();
    const point = clientToCanvasPoint(event.clientX, event.clientY, rect);
    return event.pressure > 0 ? { ...point, pressure: event.pressure } : point;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    // If a previous stroke was not properly finished, commit it now
    if (activePointerRef.current !== undefined && changedRef.current) {
      onCommit([...workingStrokesRef.current]);
      changedRef.current = false;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture might throw on certain devices or pointers
    }
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
    if (canvasRef.current) renderCanvas(canvasRef.current, workingStrokesRef.current, answerRef.current);
    requestDraw();
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      finishPointer(event);
      return;
    }
    event.preventDefault();
    const native = event.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const samples = coalesced && coalesced.length > 0 ? coalesced : [native];
    const canvas = canvasRef.current;
    const rect = canvas ? canvas.getBoundingClientRect() : event.currentTarget.getBoundingClientRect();
    for (const sample of samples) {
      const point = clientToCanvasPoint(sample.clientX, sample.clientY, rect);
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
    if (canvasRef.current) renderCanvas(canvasRef.current, workingStrokesRef.current, answerRef.current);
    requestDraw();
  };

  const finishPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current === undefined) return;
    activePointerRef.current = undefined;
    currentStrokeRef.current = undefined;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore releasePointerCapture failure
    }
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
        onLostPointerCapture={finishPointer}
      />
      <svg className="ink-preview" viewBox={`0 0 ${paperSize.width} ${paperSize.height}`} aria-hidden="true">
        {strokes.map((stroke) => {
          const first = stroke.points[0];
          if (!first) return null;
          const path = stroke.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
          const eraser = stroke.mode === 'pixel-eraser';
          return stroke.points.length === 1
            ? <circle key={stroke.id} cx={first.x} cy={first.y} r={(eraser ? stroke.width * 3 : stroke.width) / 2} fill={eraser ? '#fffefa' : '#273b34'} />
            : <path key={stroke.id} d={path} fill="none" stroke={eraser ? '#fffefa' : '#273b34'} strokeWidth={eraser ? stroke.width * 3 : stroke.width} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </svg>
    </div>
  );
}
