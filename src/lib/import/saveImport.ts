import { db } from '@/db';
import { createInitialSRSFields } from '@/features/srs/sm2';
import { createId } from '@/lib/utils';
import type { Card, Deck, DeckLanguage, ImportHistoryEntry } from '@/types';
import { CHUNK_SIZE, formatDefaultDeckName, yieldToMain } from './normalize';
import type { ParsedCardRow, PasteDuplicateStrategy } from './types';
import { buildCardMatchKey } from './validateAndDedupe';

export interface SaveImportInput {
  rows: ParsedCardRow[];
  format: string;
  target:
    | {
        mode: 'new';
        name: string;
        emoji: string;
        color: string;
        language: DeckLanguage;
        description?: string;
        tags?: string[];
      }
    | {
        mode: 'existing';
        deckId: string;
      };
  duplicateStrategy: PasteDuplicateStrategy;
  onProgress?: (progress: number) => void;
  /** Internal hook used by unit tests to verify atomic transaction rollback. */
  __simulateFailureBeforeCommit?: boolean;
}

export interface SaveImportResult {
  historyEntry: ImportHistoryEntry;
  deck: Deck;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
}

const DB_CHUNK_SIZE = 500;

/**
 * Commit parsed rows into IndexedDB within a single all-or-nothing Dexie transaction.
 */
export async function saveImportedDeckOrCards(input: SaveImportInput): Promise<SaveImportResult> {
  const now = Date.now();
  const validRows = input.rows.filter((r) => !r.hasError);

  if (validRows.length === 0) {
    throw new Error('No valid cards to import.');
  }

  let deckLanguage: DeckLanguage;
  let existingDeck: Deck | undefined;

  if (input.target.mode === 'existing') {
    existingDeck = await db.decks.get(input.target.deckId);
    if (!existingDeck) {
      throw new Error('Selected target deck was not found.');
    }
    deckLanguage = existingDeck.language || 'en';
  } else {
    deckLanguage = input.target.language;
  }

  const existingCards =
    input.target.mode === 'existing'
      ? await db.cards.where('deckId').equals(input.target.deckId).toArray()
      : [];

  const existingByKey = new Map<string, Card>();
  for (const card of existingCards) {
    const key = buildCardMatchKey(card, deckLanguage);
    if (key && !existingByKey.has(key)) {
      existingByKey.set(key, card);
    }
  }

  const targetDeck: Deck =
    existingDeck ??
    ({
      id: createId('deck'),
      name:
        input.target.mode === 'new'
          ? input.target.name.trim() || formatDefaultDeckName()
          : 'Imported Deck',
      description: input.target.mode === 'new' ? (input.target.description ?? '').trim() : '',
      emoji:
        input.target.mode === 'new'
          ? input.target.emoji || (deckLanguage === 'ja' ? '🇯🇵' : '📘')
          : '📘',
      color: input.target.mode === 'new' ? input.target.color || '#4f46e5' : '#4f46e5',
      language: deckLanguage,
      createdAt: now,
      updatedAt: now,
      tags: input.target.mode === 'new' ? (input.target.tags ?? []) : [],
    } satisfies Deck);

  const cardsToAdd: Card[] = [];
  const cardsToOverwrite: Card[] = [];
  const overwrittenSnapshots: Card[] = [];
  const capturedOverwriteIds = new Set<string>();
  const seenBatchKeys = new Set<string>();

  let skippedCount = 0;

  // Prepare payloads BEFORE opening IDB transaction so async UI yields never expire transaction
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const cleanTerm = row.term.trim() || (deckLanguage === 'ja' ? row.kana.trim() : '');
    const cleanMeaning = row.meaning.trim();
    if (!cleanTerm || !cleanMeaning) {
      skippedCount++;
      continue;
    }

    const matchKey = buildCardMatchKey({ term: cleanTerm, kana: row.kana }, deckLanguage);
    const existingMatch = matchKey ? existingByKey.get(matchKey) : undefined;
    const isBatchDup = matchKey ? seenBatchKeys.has(matchKey) : false;

    if (isBatchDup && input.duplicateStrategy !== 'keep') {
      skippedCount++;
      continue;
    }

    if (matchKey) seenBatchKeys.add(matchKey);

    if (existingMatch && input.duplicateStrategy === 'skip') {
      skippedCount++;
      continue;
    }

    if (existingMatch && input.duplicateStrategy === 'overwrite') {
      if (!capturedOverwriteIds.has(existingMatch.id)) {
        overwrittenSnapshots.push({ ...existingMatch });
        capturedOverwriteIds.add(existingMatch.id);
      }
      cardsToOverwrite.push({
        ...existingMatch,
        term: cleanTerm,
        meaning: cleanMeaning,
        phonetic: row.phonetic || existingMatch.phonetic,
        partOfSpeech: row.partOfSpeech || existingMatch.partOfSpeech,
        example: row.example || existingMatch.example,
        exampleTranslation: row.exampleTranslation || existingMatch.exampleTranslation,
        notes: row.notes || existingMatch.notes,
        tags: row.tags.length > 0 ? row.tags : existingMatch.tags,
        kana: deckLanguage === 'ja' ? row.kana || cleanTerm : row.kana || existingMatch.kana,
        romaji:
          deckLanguage === 'ja'
            ? row.romaji || existingMatch.romaji
            : row.romaji || existingMatch.romaji,
        kanji: row.kanji || existingMatch.kanji,
        wordType: row.wordType ?? existingMatch.wordType,
        lesson: row.lesson ?? existingMatch.lesson,
        verbForms: row.verbForms ?? existingMatch.verbForms,
        updatedAt: now,
      });
      continue;
    }

    const srs = createInitialSRSFields(now);
    const newCard: Card = {
      id: createId('card'),
      deckId: targetDeck.id,
      term: cleanTerm,
      meaning: cleanMeaning,
      phonetic: row.phonetic || '',
      partOfSpeech: row.partOfSpeech || '',
      example: row.example || '',
      exampleTranslation: row.exampleTranslation || '',
      notes: row.notes || '',
      imageUrl: '',
      tags: row.tags,
      kana: deckLanguage === 'ja' ? row.kana || cleanTerm : row.kana || undefined,
      romaji: row.romaji || undefined,
      kanji: row.kanji || undefined,
      wordType: row.wordType,
      lesson: row.lesson,
      verbForms: row.verbForms,
      createdAt: now,
      updatedAt: now,
      ...srs,
    };

    cardsToAdd.push(newCard);

    if ((i + 1) % CHUNK_SIZE === 0) {
      input.onProgress?.(Math.min(0.6, ((i + 1) / validRows.length) * 0.6));
      await yieldToMain();
    }
  }

  const historyEntry: ImportHistoryEntry = {
    id: createId('imphist'),
    createdAt: now,
    deckId: targetDeck.id,
    deckName: targetDeck.name,
    deckLanguage,
    format: input.format,
    importedCount: cardsToAdd.length,
    updatedCount: cardsToOverwrite.length,
    skippedCount,
    createdNewDeck: input.target.mode === 'new',
    createdCardIds: cardsToAdd.map((c) => c.id),
    overwrittenCards: overwrittenSnapshots,
  };

  await db.transaction('rw', [db.decks, db.cards, db.importHistory], async () => {
    if (input.target.mode === 'new') {
      await db.decks.add(targetDeck);
    } else {
      await db.decks.update(targetDeck.id, { updatedAt: now });
    }

    for (let i = 0; i < cardsToAdd.length; i += DB_CHUNK_SIZE) {
      await db.cards.bulkAdd(cardsToAdd.slice(i, i + DB_CHUNK_SIZE));
    }

    if (cardsToOverwrite.length > 0) {
      for (let i = 0; i < cardsToOverwrite.length; i += DB_CHUNK_SIZE) {
        await db.cards.bulkPut(cardsToOverwrite.slice(i, i + DB_CHUNK_SIZE));
      }
    }

    if (input.__simulateFailureBeforeCommit) {
      throw new Error('Simulated transaction failure for rollback verification');
    }

    await db.importHistory.add(historyEntry);
  });

  input.onProgress?.(1);

  return {
    historyEntry,
    deck: targetDeck,
    importedCount: cardsToAdd.length,
    updatedCount: cardsToOverwrite.length,
    skippedCount,
  };
}

export interface UndoImportResult {
  undone: boolean;
  deletedCards: number;
  restoredCards: number;
  deletedDeck: boolean;
}

/**
 * Undo a past paste-import transaction: deletes created cards, restores overwritten cards,
 * and cleans up an empty newly created deck.
 */
export async function undoImport(historyId: string): Promise<UndoImportResult> {
  let result: UndoImportResult = {
    undone: false,
    deletedCards: 0,
    restoredCards: 0,
    deletedDeck: false,
  };

  await db.transaction('rw', [db.decks, db.cards, db.importHistory], async () => {
    const entry = await db.importHistory.get(historyId);
    if (!entry || entry.undoneAt) {
      return;
    }

    if (entry.createdCardIds.length > 0) {
      await db.cards.bulkDelete(entry.createdCardIds);
    }

    if (entry.overwrittenCards.length > 0) {
      await db.cards.bulkPut(entry.overwrittenCards);
    }

    let deletedDeck = false;
    if (entry.createdNewDeck) {
      const remaining = await db.cards.where('deckId').equals(entry.deckId).count();
      if (remaining === 0) {
        await db.decks.delete(entry.deckId);
        deletedDeck = true;
      }
    } else {
      await db.decks.update(entry.deckId, { updatedAt: Date.now() });
    }

    await db.importHistory.update(historyId, { undoneAt: Date.now() });

    result = {
      undone: true,
      deletedCards: entry.createdCardIds.length,
      restoredCards: entry.overwrittenCards.length,
      deletedDeck,
    };
  });

  return result;
}

export async function getRecentImportHistory(limit = 15): Promise<ImportHistoryEntry[]> {
  return db.importHistory.orderBy('createdAt').reverse().limit(limit).toArray();
}
