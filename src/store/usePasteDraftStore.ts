import { create } from 'zustand';
import type { DeckLanguage } from '@/types';
import type { LineSeparator, PasteDuplicateStrategy, PasteFormat } from '@/lib/import';

interface PasteDraftState {
  rawText: string;
  format: PasteFormat;
  separatorOverride?: LineSeparator;
  targetMode: 'new' | 'existing';
  targetDeckId: string;
  newDeckName: string;
  deckNameTouched: boolean;
  newDeckEmoji: string;
  newDeckColor: string;
  languageOverride?: DeckLanguage;
  batchLessonRaw: string;
  batchTagsRaw: string;
  duplicateStrategy: PasteDuplicateStrategy;
  setDraft: (patch: Partial<Omit<PasteDraftState, 'setDraft' | 'resetDraft'>>) => void;
  resetDraft: () => void;
}

const INITIAL_DRAFT = {
  rawText: '',
  format: 'auto' as PasteFormat,
  separatorOverride: undefined as LineSeparator | undefined,
  targetMode: 'new' as 'new' | 'existing',
  targetDeckId: '',
  newDeckName: '',
  deckNameTouched: false,
  newDeckEmoji: '📘',
  newDeckColor: '#4f46e5',
  languageOverride: undefined as DeckLanguage | undefined,
  batchLessonRaw: '',
  batchTagsRaw: '',
  duplicateStrategy: 'skip' as PasteDuplicateStrategy,
};

export const usePasteDraftStore = create<PasteDraftState>((set) => ({
  ...INITIAL_DRAFT,
  setDraft: (patch) => set((state) => ({ ...state, ...patch })),
  resetDraft: () => set({ ...INITIAL_DRAFT }),
}));
