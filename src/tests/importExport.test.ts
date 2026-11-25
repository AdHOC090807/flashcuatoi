import { describe, expect, it } from 'vitest';
import { exportCardsToAnkiTSV, exportCardsToCSV, parseImportFile } from '@/features/import-export';
import { calculateStreak, evaluateUnlockedBadges } from '@/features/gamification';
import { createInitialSRSFields, DAY_MS } from '@/features/srs/sm2';
import type { Card, ReviewLog } from '@/types';

describe('Import / Export parsers and serializers', () => {
  it('parses CSV with headers and suggests field mappings', () => {
    const csv =
      'term,meaning,phonetic,example\n"resilient","kiên cường, bền bỉ","/rɪˈzɪliənt/","She is resilient."';
    const table = parseImportFile('vocab.csv', csv);
    expect(table.format).toBe('csv');
    expect(table.headers).toEqual(['term', 'meaning', 'phonetic', 'example']);
    expect(table.suggestedMapping).toEqual(['term', 'meaning', 'phonetic', 'example']);
    expect(table.rows).toEqual([
      ['resilient', 'kiên cường, bền bỉ', '/rɪˈzɪliənt/', 'She is resilient.'],
    ]);
  });

  it('parses Anki-style TSV without headers', () => {
    const tsv = 'ephemeral\tphù du\npragmatic\tthực tế';
    const table = parseImportFile('anki.tsv', tsv);
    expect(table.format).toBe('tsv');
    expect(table.rows).toHaveLength(2);
    expect(table.suggestedMapping).toEqual(['term', 'meaning']);
  });

  it('parses JSON array of cards', () => {
    const json = JSON.stringify([{ term: 'catalyst', meaning: 'chất xúc tác', tags: ['science'] }]);
    const table = parseImportFile('cards.json', json);
    expect(table.format).toBe('json');
    expect(table.rows[0]).toEqual(['catalyst', 'chất xúc tác', 'science']);
  });

  it('exports cards to CSV and Anki TSV cleanly', () => {
    const now = Date.now();
    const cards: Card[] = [
      {
        id: '1',
        deckId: 'd1',
        term: 'hello, world',
        meaning: 'xin chào',
        phonetic: '/həˈləʊ/',
        partOfSpeech: 'phrase',
        example: 'Say "hello, world".',
        exampleTranslation: '',
        notes: '',
        imageUrl: '',
        tags: ['starter'],
        ...createInitialSRSFields(now),
        createdAt: now,
        updatedAt: now,
      },
    ];
    const csv = exportCardsToCSV(cards);
    expect(csv).toContain('"hello, world"');
    expect(csv).toContain('"Say ""hello, world""."');

    const tsv = exportCardsToAnkiTSV(cards);
    expect(tsv).toContain('hello, world\txin chào');
  });
});

describe('Gamification streak & badge evaluation', () => {
  it('computes consecutive daily streaks accurately', () => {
    const now = new Date('2026-11-25T12:00:00Z').getTime();
    const logs: ReviewLog[] = [
      {
        id: '1',
        cardId: 'c1',
        deckId: 'd1',
        rating: 3,
        mode: 'flip',
        correct: true,
        elapsedMs: 1000,
        previousInterval: 0,
        newInterval: 1,
        reviewedAt: now,
      },
      {
        id: '2',
        cardId: 'c1',
        deckId: 'd1',
        rating: 3,
        mode: 'quiz',
        correct: true,
        elapsedMs: 1000,
        previousInterval: 1,
        newInterval: 6,
        reviewedAt: now - DAY_MS,
      },
      {
        id: '3',
        cardId: 'c1',
        deckId: 'd1',
        rating: 3,
        mode: 'typing',
        correct: true,
        elapsedMs: 1000,
        previousInterval: 1,
        newInterval: 6,
        reviewedAt: now - 2 * DAY_MS,
      },
    ];

    expect(calculateStreak(logs, now)).toBe(3);
    const unlocked = evaluateUnlockedBadges(logs, [], now);
    expect(unlocked).toContain('first_review');
    expect(unlocked).toContain('streak_3');
  });
});
