import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const NOTES_KEY = 'ptp_question_notes_v1';
const FAVORITES_KEY = 'ptp_question_favorites_v1';

interface NotesState {
  notes: Record<string, string>;
  favorites: Record<string, true>;
  loaded: boolean;
  load: () => Promise<void>;
  setNote: (questionId: string, text: string) => void;
  toggleFavorite: (questionId: string) => void;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as T : fallback;
  } catch (error) {
    logger.error('notesStore:read', 'קריאת הערות/מועדפים נכשלה', error instanceof Error ? error.message : String(error));
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(error => {
    logger.error('notesStore:write', 'שמירת הערות/מועדפים נכשלה', error instanceof Error ? error.message : String(error));
  });
}

let loadPromise: Promise<void> | null = null;

/** Per-question notes and favourites, persisted locally on the device. */
export const useNotesStore = create<NotesState>((set, get) => ({
  notes: {},
  favorites: {},
  loaded: false,

  load: () => {
    if (get().loaded) return Promise.resolve();
    // Share one in-flight read: a second read finishing later would replace
    // edits made after the first one completed.
    if (!loadPromise) {
      loadPromise = Promise.all([
        readJson<Record<string, string>>(NOTES_KEY, {}),
        readJson<Record<string, true>>(FAVORITES_KEY, {}),
      ]).then(([notes, favorites]) => {
        set({ notes, favorites, loaded: true });
      }).finally(() => {
        loadPromise = null;
      });
    }
    return loadPromise;
  },

  setNote: (questionId, text) => {
    // Never overwrite stored data with a partial, not-yet-loaded snapshot.
    if (!get().loaded) {
      get().load().then(() => get().setNote(questionId, text)).catch(() => null);
      return;
    }
    const trimmed = text.trim();
    const notes = { ...get().notes };
    if (trimmed) notes[questionId] = trimmed;
    else delete notes[questionId];
    set({ notes });
    writeJson(NOTES_KEY, notes);
  },

  toggleFavorite: (questionId) => {
    if (!get().loaded) {
      get().load().then(() => get().toggleFavorite(questionId)).catch(() => null);
      return;
    }
    const favorites = { ...get().favorites };
    if (favorites[questionId]) delete favorites[questionId];
    else favorites[questionId] = true;
    set({ favorites });
    writeJson(FAVORITES_KEY, favorites);
  },
}));
