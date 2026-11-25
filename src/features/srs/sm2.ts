import type { Card, DeckCounts, ReviewRating } from '@/types';
import { endOfDayMs } from '@/lib/utils';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const MIN_EASE_FACTOR = 1.3;
export const DEFAULT_EASE_FACTOR = 2.5;

export interface SM2UpdateResult {
  easeFactor: number;
  interval: number;
  repetitions: number;
  lapses: number;
  status: Card['status'];
  dueDate: number;
  lastReviewedAt: number;
}

/**
 * Pure SM-2 spaced repetition calculation.
 * Ratings:
 *  1 = Again (lapse / reset repetitions, short re-learn delay)
 *  2 = Hard (small interval growth, slight EF reduction)
 *  3 = Good (standard SM-2 progression: 1d -> 6d -> interval * EF)
 *  4 = Easy (accelerated progression + EF boost)
 */
export function calculateSM2(
  card: Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses' | 'status'>,
  rating: ReviewRating,
  now: number = Date.now()
): SM2UpdateResult {
  let easeFactor = card.easeFactor || DEFAULT_EASE_FACTOR;
  let interval = card.interval || 0;
  let repetitions = card.repetitions || 0;
  let lapses = card.lapses || 0;
  let status: Card['status'] = card.status;
  let dueDate = now;

  if (rating === 1) {
    // Again: reset streak, mark as learning, due in 1 minute
    repetitions = 0;
    interval = 0;
    if (card.status !== 'new') {
      lapses += 1;
    }
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.2).toFixed(2)));
    status = 'learning';
    dueDate = now + MINUTE_MS;
  } else if (rating === 2) {
    // Hard
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.max(1, Math.round(interval * 1.2));
    }
    repetitions += 1;
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.15).toFixed(2)));
    status = repetitions >= 2 ? 'review' : 'learning';
    dueDate = now + interval * DAY_MS;
  } else if (rating === 3) {
    // Good
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }
    repetitions += 1;
    // Standard SM-2 EF adjustment for quality q=4 -> +0.0
    easeFactor = Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
    status = repetitions >= 2 ? 'review' : 'learning';
    dueDate = now + interval * DAY_MS;
  } else {
    // Easy (rating === 4)
    if (repetitions === 0) {
      interval = 4;
    } else if (repetitions === 1) {
      interval = 8;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor * 1.3));
    }
    repetitions += 1;
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor + 0.15).toFixed(2)));
    status = 'review';
    dueDate = now + interval * DAY_MS;
  }

  return {
    easeFactor,
    interval,
    repetitions,
    lapses,
    status,
    dueDate,
    lastReviewedAt: now,
  };
}

/**
 * Preview next interval label in days/minutes for each rating button.
 */
export function previewIntervalLabels(
  card: Pick<Card, 'easeFactor' | 'interval' | 'repetitions' | 'lapses' | 'status'>
): Record<ReviewRating, string> {
  const now = 1_700_000_000_000;
  const format = (res: SM2UpdateResult): string => {
    if (res.interval === 0) return '1m';
    if (res.interval === 1) return '1d';
    if (res.interval < 30) return `${res.interval}d`;
    const months = Math.round(res.interval / 30);
    return `${months}mo`;
  };
  return {
    1: format(calculateSM2(card, 1, now)),
    2: format(calculateSM2(card, 2, now)),
    3: format(calculateSM2(card, 3, now)),
    4: format(calculateSM2(card, 4, now)),
  };
}

/**
 * Compute New / Learning / Due counts for a set of cards.
 * Respects remaining daily new-card allowance.
 */
export function getDeckCounts(
  cards: Card[],
  newStudiedToday: number,
  dailyNewLimit: number,
  now: number = Date.now()
): DeckCounts {
  const endToday = endOfDayMs(now);
  let rawNew = 0;
  let learningCount = 0;
  let dueCount = 0;
  let masteredCount = 0;

  for (const card of cards) {
    if (card.status === 'new') {
      rawNew += 1;
    } else if (card.status === 'learning') {
      if (card.dueDate <= endToday) {
        learningCount += 1;
      }
    } else if (card.status === 'review') {
      if (card.dueDate <= endToday) {
        dueCount += 1;
      }
      if (card.interval >= 21) {
        masteredCount += 1;
      }
    }
  }

  const remainingNewQuota = Math.max(0, dailyNewLimit - newStudiedToday);
  const newCount = Math.min(rawNew, remainingNewQuota);

  return {
    newCount,
    learningCount,
    dueCount,
    totalCount: cards.length,
    masteredCount,
  };
}

/**
 * Build today's ordered study queue:
 * 1. Due learning cards (earliest dueDate first)
 * 2. Due review cards (earliest dueDate first)
 * 3. New cards up to remaining daily new-card quota (oldest createdAt first)
 */
export function buildStudyQueue(
  cards: Card[],
  newStudiedToday: number,
  dailyNewLimit: number,
  now: number = Date.now(),
  includeAllFallback = false
): Card[] {
  const endToday = endOfDayMs(now);
  const learning = cards
    .filter((c) => c.status === 'learning' && c.dueDate <= endToday)
    .sort((a, b) => a.dueDate - b.dueDate);

  const dueReviews = cards
    .filter((c) => c.status === 'review' && c.dueDate <= endToday)
    .sort((a, b) => a.dueDate - b.dueDate);

  const remainingNewQuota = Math.max(0, dailyNewLimit - newStudiedToday);
  const newCards = cards
    .filter((c) => c.status === 'new')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, remainingNewQuota);

  const queue = [...learning, ...dueReviews, ...newCards];

  if (queue.length === 0 && includeAllFallback) {
    return [...cards].sort((a, b) => a.dueDate - b.dueDate);
  }
  return queue;
}

/**
 * Create default SRS fields for a new card.
 */
export function createInitialSRSFields(
  now: number = Date.now()
): Pick<
  Card,
  'easeFactor' | 'interval' | 'repetitions' | 'lapses' | 'status' | 'dueDate' | 'lastReviewedAt'
> {
  return {
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    status: 'new',
    dueDate: now,
    lastReviewedAt: null,
  };
}
