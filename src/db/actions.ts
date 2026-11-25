import { db, DEFAULT_SETTINGS, getOrCreateSettings } from '@/db';
import { calculateXPForReview, evaluateUnlockedBadges } from '@/features/gamification';
import { calculateSM2, createInitialSRSFields } from '@/features/srs/sm2';
import { createId, normalizeText, startOfDayMs } from '@/lib/utils';
import type { Card, Deck, ReviewLog, ReviewRating, StudyMode, UserSettings } from '@/types';

export interface DeckInput {
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  tags?: string[];
}

export interface CardInput {
  deckId: string;
  term: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  exampleTranslation?: string;
  notes?: string;
  imageUrl?: string;
  tags?: string[];
}

export async function createDeck(input: DeckInput): Promise<Deck> {
  const now = Date.now();
  const deck: Deck = {
    id: createId('deck'),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    color: input.color || '#4f46e5',
    emoji: input.emoji || '📚',
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await db.decks.put(deck);
  return deck;
}

export async function updateDeck(id: string, patch: Partial<DeckInput>): Promise<void> {
  await db.decks.update(id, {
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : undefined,
    description: patch.description !== undefined ? patch.description.trim() : undefined,
    updatedAt: Date.now(),
  });
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.reviewLogs, async () => {
    await db.cards.where('deckId').equals(id).delete();
    await db.reviewLogs.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}

export async function findDuplicateTerm(
  deckId: string,
  term: string,
  excludeCardId?: string
): Promise<Card | undefined> {
  const normalized = normalizeText(term);
  if (!normalized) return undefined;
  const deckCards = await db.cards.where('deckId').equals(deckId).toArray();
  return deckCards.find((c) => c.id !== excludeCardId && normalizeText(c.term) === normalized);
}

export async function createCard(input: CardInput): Promise<Card> {
  const now = Date.now();
  const card: Card = {
    id: createId('card'),
    deckId: input.deckId,
    term: input.term.trim(),
    meaning: input.meaning.trim(),
    phonetic: (input.phonetic ?? '').trim(),
    partOfSpeech: (input.partOfSpeech ?? '').trim(),
    example: (input.example ?? '').trim(),
    exampleTranslation: (input.exampleTranslation ?? '').trim(),
    notes: (input.notes ?? '').trim(),
    imageUrl: (input.imageUrl ?? '').trim(),
    tags: input.tags ?? [],
    ...createInitialSRSFields(now),
    createdAt: now,
    updatedAt: now,
  };
  await db.cards.put(card);
  await db.decks.update(input.deckId, { updatedAt: now });
  return card;
}

export async function bulkCreateCards(
  deckId: string,
  items: Array<Omit<CardInput, 'deckId'>>,
  duplicateStrategy: 'skip' | 'update' | 'keep' = 'skip'
): Promise<{ added: number; updated: number; skipped: number }> {
  const now = Date.now();
  const existing = await db.cards.where('deckId').equals(deckId).toArray();
  const byTerm = new Map<string, Card>();
  for (const c of existing) {
    byTerm.set(normalizeText(c.term), c);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const toPut: Card[] = [];

  items.forEach((item, idx) => {
    const term = item.term.trim();
    const meaning = item.meaning.trim();
    if (!term || !meaning) {
      skipped += 1;
      return;
    }
    const key = normalizeText(term);
    const match = byTerm.get(key);

    if (match && duplicateStrategy === 'skip') {
      skipped += 1;
      return;
    }

    if (match && duplicateStrategy === 'update') {
      const updatedCard: Card = {
        ...match,
        meaning,
        phonetic: item.phonetic?.trim() ?? match.phonetic,
        partOfSpeech: item.partOfSpeech?.trim() ?? match.partOfSpeech,
        example: item.example?.trim() ?? match.example,
        exampleTranslation: item.exampleTranslation?.trim() ?? match.exampleTranslation,
        notes: item.notes?.trim() ?? match.notes,
        imageUrl: item.imageUrl?.trim() ?? match.imageUrl,
        tags: item.tags?.length ? item.tags : match.tags,
        updatedAt: now + idx,
      };
      toPut.push(updatedCard);
      byTerm.set(key, updatedCard);
      updated += 1;
      return;
    }

    const created: Card = {
      id: createId('card'),
      deckId,
      term,
      meaning,
      phonetic: (item.phonetic ?? '').trim(),
      partOfSpeech: (item.partOfSpeech ?? '').trim(),
      example: (item.example ?? '').trim(),
      exampleTranslation: (item.exampleTranslation ?? '').trim(),
      notes: (item.notes ?? '').trim(),
      imageUrl: (item.imageUrl ?? '').trim(),
      tags: item.tags ?? [],
      ...createInitialSRSFields(now + idx),
      createdAt: now + idx,
      updatedAt: now + idx,
    };
    toPut.push(created);
    byTerm.set(key, created);
    added += 1;
  });

  if (toPut.length > 0) {
    await db.transaction('rw', db.cards, db.decks, async () => {
      await db.cards.bulkPut(toPut);
      await db.decks.update(deckId, { updatedAt: now });
    });
  }

  return { added, updated, skipped };
}

export async function updateCard(id: string, patch: Partial<CardInput>): Promise<void> {
  await db.cards.update(id, {
    ...patch,
    term: patch.term !== undefined ? patch.term.trim() : undefined,
    meaning: patch.meaning !== undefined ? patch.meaning.trim() : undefined,
    updatedAt: Date.now(),
  });
}

export async function deleteCards(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction('rw', db.cards, db.reviewLogs, async () => {
    await db.cards.bulkDelete(ids);
    await db.reviewLogs.where('cardId').anyOf(ids).delete();
  });
}

export async function moveCardsToDeck(cardIds: string[], targetDeckId: string): Promise<void> {
  if (cardIds.length === 0) return;
  const now = Date.now();
  await db.transaction('rw', db.cards, db.decks, async () => {
    await db.cards.where('id').anyOf(cardIds).modify({
      deckId: targetDeckId,
      updatedAt: now,
    });
    await db.decks.update(targetDeckId, { updatedAt: now });
  });
}

export async function recordCardReview(
  card: Card,
  rating: ReviewRating,
  mode: StudyMode,
  elapsedMs: number
): Promise<{
  updatedCard: Card;
  xpEarned: number;
  newlyUnlockedBadges: string[];
}> {
  const now = Date.now();
  const srsResult = calculateSM2(card, rating, now);
  const updatedCard: Card = {
    ...card,
    ...srsResult,
    updatedAt: now,
  };

  const log: ReviewLog = {
    id: createId('log'),
    cardId: card.id,
    deckId: card.deckId,
    rating,
    mode,
    correct: rating >= 2,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    previousInterval: card.interval,
    newInterval: srsResult.interval,
    reviewedAt: now,
  };

  const xpEarned = calculateXPForReview(rating, mode);
  let newlyUnlockedBadges: string[] = [];

  await db.transaction('rw', db.cards, db.reviewLogs, db.settings, async () => {
    await db.cards.put(updatedCard);
    await db.reviewLogs.put(log);

    const settings = await getOrCreateSettings();
    const allLogs = await db.reviewLogs.toArray();
    const updatedBadges = evaluateUnlockedBadges(allLogs, settings.unlockedBadges, now);
    newlyUnlockedBadges = updatedBadges.filter((b) => !settings.unlockedBadges.includes(b));

    await db.settings.update('default', {
      xp: (settings.xp || 0) + xpEarned,
      unlockedBadges: updatedBadges,
    });
  });

  return { updatedCard, xpEarned, newlyUnlockedBadges };
}

export async function updateSettings(patch: Partial<Omit<UserSettings, 'id'>>): Promise<void> {
  await getOrCreateSettings();
  await db.settings.update('default', patch);
}

export async function getTodayReviewStats(now: number = Date.now()): Promise<{
  reviewedToday: number;
  newStudiedToday: number;
}> {
  const dayStart = startOfDayMs(now);
  const todaysLogs = await db.reviewLogs.where('reviewedAt').aboveOrEqual(dayStart).toArray();
  const uniqueCardsToday = new Set(todaysLogs.map((l) => l.cardId));
  const newCardsToday = new Set(
    todaysLogs.filter((l) => l.previousInterval === 0).map((l) => l.cardId)
  );
  return {
    reviewedToday: uniqueCardsToday.size,
    newStudiedToday: newCardsToday.size,
  };
}

export async function resetAllData(): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.reviewLogs, db.settings, async () => {
    await db.decks.clear();
    await db.cards.clear();
    await db.reviewLogs.clear();
    await db.settings.put({ ...DEFAULT_SETTINGS, onboardingCompleted: true });
  });
}
