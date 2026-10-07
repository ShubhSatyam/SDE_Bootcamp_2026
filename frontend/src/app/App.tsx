import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingCanvas } from '../features/canvas/components/DrawingCanvas';
import { StrokeHistory } from '../state/StrokeHistory';
import { useRecognition } from '../features/recognition/hooks/useRecognition';
import type { Stroke, Tool } from '../types/strokes';
import { createNote, loadNotes, saveNotes, type Note } from '../state/notes';

const activeNoteStorageKey = 'calcink-active-note-v1';

function getInitialNoteId(notes: Note[]): string {
  try {
    const storedId = localStorage.getItem(activeNoteStorageKey);
    return notes.some((note) => note.id === storedId) ? storedId! : notes[0].id;
  } catch {
    return notes[0].id;
  }
}

function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeNoteId, setActiveNoteId] = useState(() => getInitialNoteId(notes));
  const activeNote = notes.find((note) => note.id === activeNoteId) ?? notes[0];
  const historyRef = useRef(new StrokeHistory(activeNote.strokes));
  const [storageError, setStorageError] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>(() => activeNote?.strokes ?? []);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [eraseMenuOpen, setEraseMenuOpen] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [online, setOnline] = useState(navigator.onLine);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('calcink-theme') === 'dark');
  const { state: recognition, recognizeStrokes, modelProgress } = useRecognition();
  const initialStrokesRef = useRef(strokes);

  useEffect(() => {
    if (initialStrokesRef.current.length > 0) recognizeStrokes(initialStrokesRef.current);
  }, [recognizeStrokes]);

  const syncHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo);
    setCanRedo(historyRef.current.canRedo);
  }, []);

  const applyHistory = useCallback((next: Stroke[]) => {
    setStrokes(next);
    setNotes((current) => current.map((note) => note.id === activeNoteId ? { ...note, strokes: next, updatedAt: Date.now() } : note));
    syncHistoryState();
    recognizeStrokes(next);
  }, [activeNoteId, recognizeStrokes, syncHistoryState]);

  const commitStrokes = useCallback((next: Stroke[]) => {
    applyHistory(historyRef.current.commit(next));
  }, [applyHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.canUndo) applyHistory(historyRef.current.undo());
  }, [applyHistory]);

  const redo = useCallback(() => {
    if (historyRef.current.canRedo) applyHistory(historyRef.current.redo());
  }, [applyHistory]);

  const selectNote = useCallback((note: Note) => {
    setActiveNoteId(note.id);
    historyRef.current = new StrokeHistory(note.strokes);
    setStrokes(note.strokes);
    setCanUndo(false);
    setCanRedo(false);
    recognizeStrokes(note.strokes);
  }, [recognizeStrokes]);

  const addNote = useCallback(() => {
    const note = createNote(`Note ${notes.length + 1}`);
    setNotes((current) => [...current, note]);
    selectNote(note);
  }, [notes.length, selectNote]);

  const renameNote = useCallback((title: string) => {
    setNotes((current) => current.map((note) => note.id === activeNoteId ? { ...note, title, updatedAt: Date.now() } : note));
  }, [activeNoteId]);

  const deleteNote = useCallback(() => {
    if (notes.length <= 1 || !window.confirm(`Delete “${activeNote.title}”? This cannot be undone.`)) return;
    const remaining = notes.filter((note) => note.id !== activeNoteId);
    setNotes(remaining);
    selectNote(remaining[0]);
  }, [activeNote, activeNoteId, notes, selectNote]);

  const clear = useCallback(() => {
    if (strokes.length > 0) commitStrokes([]);
  }, [commitStrokes, strokes.length]);

  useEffect(() => {
    setStorageError(!saveNotes(notes));
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(activeNoteStorageKey, activeNoteId);
    } catch {
      // Keep the current session usable if browser storage is unavailable.
    }
  }, [activeNoteId]);

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
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('calcink-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
        <button
          className="theme-toggle"
          type="button"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={darkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setDarkMode((current) => !current)}
        >
          <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
          <span>{darkMode ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      <section className="welcome" aria-label="Current note">
        <h1>{activeNote.title || 'Untitled note'}</h1>
      </section>

      <section className="workspace" aria-label="Calculator workspace">
        <div className="workspace-topline">
          <div className="workspace-heading">
            <span className="workspace-icon" aria-hidden="true">✳</span>
            <div><strong>Notes</strong><span>Saved on this device</span></div>
          </div>
          <div className="notes-controls">
            <label className="note-picker-label">
              <span className="sr-only">Choose a note</span>
              <select value={activeNote.id} onChange={(event) => { const note = notes.find((item) => item.id === event.target.value); if (note) selectNote(note); }}>
                {notes.map((note) => <option key={note.id} value={note.id}>{note.title || 'Untitled note'}</option>)}
              </select>
            </label>
            <input className="note-title-input" aria-label="Rename active note" value={activeNote.title} onChange={(event) => renameNote(event.target.value)} />
            <button className="note-action" type="button" onClick={addNote}>+ New</button>
            <button className="note-action delete-note" type="button" onClick={deleteNote} disabled={notes.length <= 1} aria-label="Delete active note" title="Delete this note">Delete</button>
          </div>
        </div>

        <div className="toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="tool-group" aria-label="Ink tools">
            <button className={`tool-button ${tool === 'pen' ? 'selected' : ''}`} onClick={() => { setTool('pen'); setEraseMenuOpen(false); }} aria-pressed={tool === 'pen'} title="Write">
              <svg className="tool-icon pencil-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.7 7.8a2.1 2.1 0 0 0-3-3L4 16.5Z"/><path d="m14.9 6.6 3 3"/></svg><span>Write</span>
            </button>
            <div className="erase-tool-wrap">
              <button
                className={`tool-button ${tool !== 'pen' ? 'selected' : ''}`}
                type="button"
                aria-haspopup="true"
                aria-expanded={eraseMenuOpen}
                onClick={() => setEraseMenuOpen((open) => !open)}
                title="Choose an eraser"
              >
                <svg className="tool-icon eraser-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7.2 19-3.1-3.1a2.3 2.3 0 0 1 0-3.3l7.3-7.3a2.3 2.3 0 0 1 3.3 0l5 5a2.3 2.3 0 0 1 0 3.3L13.2 19H7.2Z"/><path d="m8.3 8.5 7.2 7.2M13.2 19H21"/></svg><span>Erase</span><span className="erase-chevron" aria-hidden="true">⌄</span>
              </button>
              {eraseMenuOpen && (
                <div className="erase-menu" role="group" aria-label="Eraser type">
                  <button className={`erase-option ${tool === 'stroke-eraser' ? 'selected' : ''}`} type="button" onClick={() => { setTool('stroke-eraser'); setEraseMenuOpen(false); }}>
                    <span className="erase-option-icon" aria-hidden="true">▱</span><span><strong>Whole stroke</strong><small>Remove a complete mark</small></span>
                  </button>
                  <button className={`erase-option ${tool === 'pixel-eraser' ? 'selected' : ''}`} type="button" onClick={() => { setTool('pixel-eraser'); setEraseMenuOpen(false); }}>
                    <span className="erase-option-icon pixel-option-icon" aria-hidden="true">◌</span><span><strong>Pixel</strong><small>Erase only where you drag</small></span>
                  </button>
                </div>
              )}
            </div>
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
        <p className="eraser-help">Erase whole marks or remove only the ink under the pointer.</p>
        {storageError && <p className="storage-error" role="alert">Could not save notes in this browser. Storage may be full or unavailable.</p>}

        <div className="paper-scroll" aria-label="Writing area">
          <DrawingCanvas
            strokes={strokes}
            answer={hasExpression ? recognition.result : ''}
            recognizedExpression={recognition.expression}
            tool={tool}
            strokeWidth={strokeWidth}
            onCommit={commitStrokes}
          />
        </div>

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
