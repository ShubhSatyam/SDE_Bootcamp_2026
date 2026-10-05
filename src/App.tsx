import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingCanvas } from './canvas/DrawingCanvas';
import { StrokeHistory } from './state/StrokeHistory';
import { useRecognition } from './hooks/useRecognition';
import type { Stroke, Tool } from './types/strokes';

function App() {
  const historyRef = useRef(new StrokeHistory());
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [online, setOnline] = useState(navigator.onLine);
  const { state: recognition, recognizeStrokes, modelProgress } = useRecognition();

  const syncHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo);
    setCanRedo(historyRef.current.canRedo);
  }, []);

  const applyHistory = useCallback((next: Stroke[]) => {
    setStrokes(next);
    syncHistoryState();
    recognizeStrokes(next);
  }, [recognizeStrokes, syncHistoryState]);

  const commitStrokes = useCallback((next: Stroke[]) => {
    applyHistory(historyRef.current.commit(next));
  }, [applyHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.canUndo) applyHistory(historyRef.current.undo());
  }, [applyHistory]);

  const redo = useCallback(() => {
    if (historyRef.current.canRedo) applyHistory(historyRef.current.redo());
  }, [applyHistory]);

  const clear = useCallback(() => {
    if (strokes.length > 0) commitStrokes([]);
  }, [commitStrokes, strokes.length]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key.toLowerCase() === 'e') {
        setTool((current) => current === 'stroke-eraser' ? 'pen' : 'stroke-eraser');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const statusLabel = recognition.status === 'loading'
    ? 'Preparing the local model'
    : recognition.status === 'recognizing'
      ? 'Reading your ink'
      : recognition.status === 'unrecognized'
        ? 'Could not read the handwriting'
      : recognition.status === 'error'
        ? 'Recognition needs attention'
        : online
          ? 'Ready, works offline'
          : 'Offline and ready';
  const hasExpression = Boolean(recognition.expression);
  const confidencePercent = recognition.confidence === undefined ? null : Math.round(recognition.confidence * 100);
  const notepadExpression = recognition.status === 'ready' && hasExpression
    ? recognition.expression
    : recognition.status === 'unrecognized'
      ? 'Not readable yet'
      : recognition.status === 'loading' || recognition.status === 'recognizing'
        ? 'Reading…'
        : 'Start writing';
  const notepadAnswer = hasExpression
    ? `${recognition.expression} = ${recognition.result}`
    : recognition.status === 'unrecognized'
      ? 'This part is unclear — try writing it more cleanly.'
      : recognition.status === 'error'
        ? 'Recognition is unavailable right now.'
        : 'Write a calculation to see the answer here.';

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="CalcInk home">
          <span className="brand-mark" aria-hidden="true"><span>+</span><span>−</span></span>
          <span>calc<span className="brand-ink">ink</span></span>
        </a>
        <div className={`connection-pill ${recognition.status === 'error' ? 'has-error' : ''}`}>
          <span className="status-dot" />
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className="welcome">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR THOUGHTS, CALCULATED</div>
        <h1>Just write it <em>out.</em></h1>
        <p>A little space for numbers to make sense. Write naturally; your answer appears right where you need it.</p>
      </section>

      <section className="workspace" aria-label="Calculator workspace">
        <div className="workspace-topline">
          <div className="workspace-heading">
            <span className="workspace-icon" aria-hidden="true">✳</span>
            <div><strong>Your scratchpad</strong><span>One step at a time</span></div>
          </div>
          <div className="privacy-note"><span aria-hidden="true">●</span> Private by design</div>
        </div>

        <div className="toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="tool-group" aria-label="Ink tools">
            <button className={`tool-button ${tool === 'pen' ? 'selected' : ''}`} onClick={() => setTool('pen')} aria-pressed={tool === 'pen'} title="Pen">
              <span className="tool-symbol pen-symbol" aria-hidden="true">／</span><span>Write</span>
            </button>
            <button className={`tool-button ${tool === 'stroke-eraser' ? 'selected' : ''}`} onClick={() => setTool('stroke-eraser')} aria-pressed={tool === 'stroke-eraser'} title="Erase whole strokes (E)">
              <span className="tool-symbol eraser-symbol" aria-hidden="true">▱</span><span>Stroke</span>
            </button>
            <button className={`tool-button ${tool === 'pixel-eraser' ? 'selected' : ''}`} onClick={() => setTool('pixel-eraser')} aria-pressed={tool === 'pixel-eraser'} title="Erase ink pixels">
              <span className="tool-symbol pixel-symbol" aria-hidden="true">◌</span><span>Pixel</span>
            </button>
          </div>
          <span className="toolbar-divider" />
          <div className="history-tools">
            <button className="icon-button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
              <span aria-hidden="true">↶</span>
            </button>
            <button className="icon-button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
              <span aria-hidden="true">↷</span>
            </button>
          </div>
          <span className="toolbar-divider width-divider" />
          <label className="width-control">
            <span>INK</span>
            <input type="range" min="2" max="12" step="1" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} aria-label="Stroke width" />
            <span className="width-preview" style={{ width: `${strokeWidth + 3}px`, height: `${strokeWidth + 3}px` }} />
          </label>
          <button className="clear-button" onClick={clear} disabled={strokes.length === 0} title="Clear the page">
            <span aria-hidden="true">⌫</span> Clear
          </button>
        </div>

        <DrawingCanvas
          strokes={strokes}
          answer={hasExpression ? recognition.result : ''}
          recognizedExpression={recognition.expression}
          tool={tool}
          strokeWidth={strokeWidth}
          onCommit={commitStrokes}
        />

        <div className="workspace-footer">
          <div className="recognition-status" aria-live="polite">
            {recognition.status === 'loading' || recognition.status === 'recognizing'
              ? <span className="loading-spinner" aria-hidden="true" />
              : <span className={`footer-status-dot ${recognition.status === 'error' ? 'error' : ''}`} aria-hidden="true" />}
            <span>{recognition.status === 'loading'
              ? modelProgress
              : recognition.status === 'recognizing'
                ? 'Reading your handwriting…'
                : recognition.status === 'unrecognized'
                  ? recognition.message
                : recognition.status === 'error'
                  ? 'Local recognition could not start.'
                  : hasExpression
                    ? `Read as ${recognition.expression}${confidencePercent === null ? '' : ` · ${confidencePercent}% confidence`}`
                    : 'Ready for your next thought'}</span>
          </div>
          <div className="workspace-meta">
            {hasExpression && (
              <span className="result-chip" aria-label={`Current expression result ${recognition.result}`}>
                {recognition.result}
              </span>
            )}
            <div className="shortcut-hint"><kbd>⌘</kbd><kbd>Z</kbd> to undo <span>·</span> <kbd>E</kbd> stroke eraser</div>
          </div>
        </div>
        {recognition.status === 'error' && (
          <p className="error-detail" role="alert">
            {recognition.message} Check that the local model assets finished loading, then reload CalcInk.
          </p>
        )}
      </section>

      <section className="recognition-notepad" aria-live="polite" aria-label="Recognized calculation note">
        <div className="notepad-header">
          <span className="notepad-pill">Live note</span>
          <span className="notepad-status">{recognition.status === 'unrecognized' ? 'Needs a clearer stroke' : recognition.status === 'ready' && hasExpression ? 'Recognized' : 'Waiting for input'}</span>
        </div>
        <div className="notepad-grid" role="note">
          <div className="notepad-line">
            <span className="notepad-label">User note</span>
            <span className={`notepad-expression ${recognition.status === 'unrecognized' ? 'unclear' : ''}`}>
              {notepadExpression}
            </span>
          </div>
          <div className="notepad-line">
            <span className="notepad-label">Answer</span>
            <span className={`notepad-answer ${hasExpression ? 'resolved' : ''}`}>
              {notepadAnswer}
            </span>
          </div>
        </div>
      </section>

      <footer className="page-footer">
        <span>Made for the joy of figuring it out.</span>
        <span><span className="footer-lock" aria-hidden="true">◇</span> All work stays on this device</span>
      </footer>
    </main>
  );
}

export default App;
