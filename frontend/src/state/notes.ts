import type { Stroke } from '../types/strokes';

export type Note = {
  id: string;
  title: string;
  strokes: Stroke[];
  updatedAt: number;
};

const storageKey = 'calcink-notes-v1';

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createNote(title = 'Untitled note'): Note {
  return { id: createId(), title, strokes: [], updatedAt: Date.now() };
}

export function loadNotes(): Note[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [createNote('My first note')];
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return [createNote('My first note')];
    const notes = value.filter((item): item is Note =>
      item !== null && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.title === 'string' &&
      Array.isArray(item.strokes) && typeof item.updatedAt === 'number',
    );
    return notes.length > 0 ? notes : [createNote('My first note')];
  } catch {
    return [createNote('My first note')];
  }
}

export function saveNotes(notes: Note[]): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}
