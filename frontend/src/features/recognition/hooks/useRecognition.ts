import { useCallback, useEffect, useRef, useState } from 'react';
import { interpretRecognition, isSupportedMathExpression } from '../interpret';
import type { RecognitionState, Stroke } from '../../../types/strokes';

type WorkerMessage =
  | { type: 'progress'; message: string }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string; confidence: number }
  | { type: 'error'; id?: number; message: string };

const minimumRecognitionConfidence = 0.35;

export function useRecognition() {
  const [modelProgress, setModelProgress] = useState('Starting local recognition worker…');
  const [state, setState] = useState<RecognitionState>({
    status: 'loading',
    expression: '',
    result: '',
  });
  const workerRef = useRef<Worker>();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);
  const latestRequestRef = useRef(0);
  const readyRef = useRef(false);
  const pendingStrokesRef = useRef<Stroke[] | null>(null);

  useEffect(() => {
    let active = true;
    let cancelControllerWait: (() => void) | undefined;
    const worker = new Worker(new URL('../workers/recognition.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      if (!active) return;
      const message = event.data;
      if (message.type === 'ready') {
        readyRef.current = true;
        setState((previous) => ({ ...previous, status: 'ready' }));
        if (pendingStrokesRef.current) {
          const pending = pendingStrokesRef.current;
          pendingStrokesRef.current = null;
          scheduleRecognition(pending, latestRequestRef.current);
        }
      } else if (message.type === 'progress') {
        setModelProgress(message.message);
        setState((previous) => ({ ...previous, status: 'loading' }));
      } else if (message.type === 'result') {
        if (message.id !== latestRequestRef.current) return;
        const interpreted = interpretRecognition(message.text);
        if (
          message.confidence < minimumRecognitionConfidence
          || !isSupportedMathExpression(interpreted.expression)
          || interpreted.result === 'Invalid expression'
        ) {
          setState({
            status: 'unrecognized',
            expression: '',
            result: '',
            confidence: message.confidence,
            message: message.confidence < minimumRecognitionConfidence
              ? 'The handwriting was ambiguous. Try writing it more clearly.'
              : 'Only numbers, parentheses, and +, −, ×, ÷, decimal points, and = are supported.',
          });
          return;
        }
        setState({ status: 'ready', ...interpreted, confidence: message.confidence });
      } else {
        if (message.id !== undefined) {
          if (message.id !== latestRequestRef.current) return;
          setState({
            status: 'unrecognized',
            expression: '',
            result: '',
            message: 'Could not read the handwriting. Try writing it more clearly.',
          });
          return;
        }
        setState({
          status: 'error',
          expression: '',
          result: '',
          message: message.message,
        });
      }
    });
    worker.addEventListener('error', (event) => {
      if (!active) return;
      setState({ status: 'error', expression: '', result: '', message: event.message || 'Recognition worker failed' });
    });

    void (async () => {
      try {
        if (import.meta.env.DEV && 'serviceWorker' in navigator) {
          // Never let the offline cache serve Vite's changing development
          // modules. Remove a previous dev registration before loading them.
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames
            .filter((name) => name.startsWith('calcink-'))
            .map((name) => caches.delete(name)));
        } else if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) {
            await new Promise<void>((resolve) => {
              const finish = () => {
                window.clearTimeout(timeout);
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve();
              };
              function onControllerChange() {
                finish();
              }
              const timeout = window.setTimeout(finish, 3000);
              cancelControllerWait = finish;
              navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
            });
          }
        }
        if (active) worker.postMessage({ type: 'initialize' });
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            expression: '',
            result: '',
            message: error instanceof Error ? error.message : 'Could not initialize offline support',
          });
        }
      }
    })();

    return () => {
      active = false;
      cancelControllerWait?.();
      if (timerRef.current) clearTimeout(timerRef.current);
      worker.terminate();
      workerRef.current = undefined;
    };
  }, []);

  const scheduleRecognition = useCallback((strokes: Stroke[], requestId: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (workerRef.current && readyRef.current && requestId === latestRequestRef.current) {
        workerRef.current.postMessage({ type: 'recognize', id: requestId, strokes });
      }
    }, 500);
  }, []);

  const recognizeStrokes = useCallback((strokes: Stroke[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const requestId = ++requestIdRef.current;
    latestRequestRef.current = requestId;
    if (strokes.length === 0) {
      pendingStrokesRef.current = null;
      setState({ status: readyRef.current ? 'ready' : 'loading', expression: '', result: '' });
      return;
    }
    setState((previous) => ({ ...previous, status: readyRef.current ? 'recognizing' : 'loading' }));
    const snapshot = strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) }));
    if (!readyRef.current) pendingStrokesRef.current = snapshot;
    else scheduleRecognition(snapshot, requestId);
  }, [scheduleRecognition]);

  return { state, recognizeStrokes, modelProgress };
}
