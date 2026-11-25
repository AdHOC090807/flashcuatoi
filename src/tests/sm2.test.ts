import { describe, expect, it } from 'vitest';
import {
  buildStudyQueue,
  calculateSM2,
  createInitialSRSFields,
  DAY_MS,
  getDeckCounts,
  MIN_EASE_FACTOR,
  MINUTE_MS,
  previewIntervalLabels,
} from '@/features/srs/sm2';
import { isTolerantMatch, normalizeText } from '@/lib/utils';
import type { Card } from '@/types';

function makeCard(overrides: Partial<Card> = {}): Card {
  const now = 1_700_000_000_000;
  return {
    id: 'c1',
    deckId: 'd1',
    term: 'resilient',
    meaning: 'kiên cường',
    phonetic: '/rɪˈzɪliənt/',
    partOfSpeech: 'adjective',
    example: 'She is resilient.',
    exampleTranslation: 'Cô ấy kiên cường.',
    notes: '',
    imageUrl: '',
    tags: [],
    ...createInitialSRSFields(now),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SM-2 spaced repetition engine', () => {
  const now = 1_700_000_000_000;

  it('progresses a new card rated Good (3) through 1d -> 6d -> interval*EF', () => {
    const card = makeCard();
    const first = calculateSM2(card, 3, now);
    expect(first.interval).toBe(1);
    expect(first.repetitions).toBe(1);
    expect(first.status).toBe('learning');
    expect(first.dueDate).toBe(now + DAY_MS);

    const second = calculateSM2({ ...card, ...first }, 3, now + DAY_MS);
    expect(second.interval).toBe(6);
    expect(second.repetitions).toBe(2);
    expect(second.status).toBe('review');

    const third = calculateSM2({ ...card, ...second }, 3, now + 7 * DAY_MS);
    expect(third.interval).toBe(Math.round(6 * 2.5));
    expect(third.repetitions).toBe(3);
    expect(third.status).toBe('review');
  });

  it('accelerates interval and increases ease factor when rated Easy (4)', () => {
    const card = makeCard();
    const res = calculateSM2(card, 4, now);
    expect(res.interval).toBe(4);
    expect(res.easeFactor).toBe(2.65);
    expect(res.status).toBe('review');
  });

  it('resets repetitions, increments lapses on non-new cards, and sets 1m delay on Again (1)', () => {
    const reviewCard = makeCard({
      status: 'review',
      repetitions: 4,
      interval: 20,
      easeFactor: 2.5,
      lapses: 0,
    });
    const res = calculateSM2(reviewCard, 1, now);
    expect(res.repetitions).toBe(0);
    expect(res.interval).toBe(0);
    expect(res.lapses).toBe(1);
    expect(res.status).toBe('learning');
    expect(res.easeFactor).toBe(2.3);
    expect(res.dueDate).toBe(now + MINUTE_MS);
  });

  it('never drops ease factor below MIN_EASE_FACTOR (1.3)', () => {
    const card = makeCard({ easeFactor: 1.35, status: 'review', repetitions: 2 });
    const res = calculateSM2(card, 1, now);
    expect(res.easeFactor).toBe(MIN_EASE_FACTOR);
  });

  it('handles Hard (2) rating with conservative interval growth and -0.15 EF', () => {
    const card = makeCard({ status: 'review', repetitions: 3, interval: 10, easeFactor: 2.5 });
    const res = calculateSM2(card, 2, now);
    expect(res.interval).toBe(12);
    expect(res.easeFactor).toBe(2.35);
    expect(res.repetitions).toBe(4);
  });

  it('computes accurate New / Learning / Due counts respecting dailyNewLimit', () => {
    const cards: Card[] = [
      makeCard({ id: 'n1', status: 'new' }),
      makeCard({ id: 'n2', status: 'new' }),
      makeCard({ id: 'n3', status: 'new' }),
      makeCard({ id: 'l1', status: 'learning', dueDate: now - 1000 }),
      makeCard({ id: 'r1', status: 'review', dueDate: now - 5000, interval: 25 }),
      makeCard({ id: 'r2', status: 'review', dueDate: now + 5 * DAY_MS, interval: 10 }),
    ];

    const counts = getDeckCounts(cards, 1, 2, now);
    expect(counts.newCount).toBe(1); // quota 2 - 1 already studied = 1
    expect(counts.learningCount).toBe(1);
    expect(counts.dueCount).toBe(1);
    expect(counts.masteredCount).toBe(1);
    expect(counts.totalCount).toBe(6);
  });

  it('builds study queue prioritizing learning -> due review -> capped new cards', () => {
    const cards: Card[] = [
      makeCard({ id: 'new1', status: 'new', createdAt: now + 1 }),
      makeCard({ id: 'new2', status: 'new', createdAt: now + 2 }),
      makeCard({ id: 'due1', status: 'review', dueDate: now - 1000 }),
      makeCard({ id: 'learn1', status: 'learning', dueDate: now - 2000 }),
      makeCard({ id: 'future', status: 'review', dueDate: now + 3 * DAY_MS }),
    ];

    const queue = buildStudyQueue(cards, 0, 1, now);
    expect(queue.map((c) => c.id)).toEqual(['learn1', 'due1', 'new1']);
  });

  it('provides human-readable interval previews for all 4 ratings', () => {
    const labels = previewIntervalLabels(makeCard());
    expect(labels[1]).toBe('1m');
    expect(labels[2]).toBe('1d');
    expect(labels[3]).toBe('1d');
    expect(labels[4]).toBe('4d');
  });
});

describe('Tolerant text matching for Typing mode', () => {
  it('normalizes Vietnamese diacritics and case', () => {
    expect(normalizeText('Kiên Cường!')).toBe('kien cuong');
    expect(normalizeText('  Đổi mới  ')).toBe('doi moi');
  });

  it('matches exact and minor typo answers while rejecting unrelated ones', () => {
    expect(isTolerantMatch('resilient', 'resilient')).toEqual({
      isMatch: true,
      isExact: true,
      distance: 0,
    });
    expect(isTolerantMatch('resilent', 'resilient').isMatch).toBe(true);
    expect(isTolerantMatch('kien cuong', 'kiên cường; bền bỉ').isMatch).toBe(true);
    expect(isTolerantMatch('banana', 'resilient').isMatch).toBe(false);
  });
});
