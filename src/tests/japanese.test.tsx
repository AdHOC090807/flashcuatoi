import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
import { LexiCardsDatabase } from '@/db';
import {
  isJapaneseMatch,
  kanaToRomaji,
  normalizeJapaneseForComparison,
  pickJapaneseQuizDistractors,
} from '@/features/japanese';
import { buildJapanesePresetMapping } from '@/features/import-export';
import { createInitialSRSFields } from '@/features/srs/sm2';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import type { Card } from '@/types';

function makeJaCard(overrides: Partial<Card> = {}): Card {
  const now = 1_700_000_000_000;
  return {
    id: 'ja1',
    deckId: 'd_ja',
    term: 'たべる',
    kana: 'たべる',
    romaji: 'taberu',
    kanji: '食べる',
    wordType: 'verb',
    lesson: 2,
    meaning: 'ăn',
    phonetic: 'taberu',
    partOfSpeech: 'verb',
    example: '',
    exampleTranslation: '',
    notes: '',
    imageUrl: '',
    tags: [],
    ...createInitialSRSFields(now),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Japanese romaji <-> kana & tolerant matching', () => {
  it('converts kana to romaji via wanakana', () => {
    expect(kanaToRomaji('たべる')).toBe('taberu');
    expect(kanaToRomaji('ありがとう')).toBe('arigatou');
  });

  it('matches kana and romaji equivalents (taberu == たべる)', () => {
    const card = makeJaCard();
    expect(isJapaneseMatch('たべる', card).isMatch).toBe(true);
    expect(isJapaneseMatch('taberu', card).isMatch).toBe(true);
    expect(isJapaneseMatch('タベル', card).isMatch).toBe(true); // katakana-hiragana equivalence
    expect(isJapaneseMatch('nomu', card).isMatch).toBe(false);
  });

  it('normalizes long vowels (ou / oo / ō / ー) equivalently', () => {
    expect(normalizeJapaneseForComparison('toukyou')).toBe(
      normalizeJapaneseForComparison('とうきょう')
    );
    expect(normalizeJapaneseForComparison('tookyoo')).toBe(
      normalizeJapaneseForComparison('とうきょう')
    );
    expect(normalizeJapaneseForComparison('tōkyō')).toBe(
      normalizeJapaneseForComparison('とうきょう')
    );
    expect(isJapaneseMatch('arigatoo', 'ありがとう').isMatch).toBe(true);
    expect(isJapaneseMatch('arigatō', 'ありがとう').isMatch).toBe(true);
    expect(isJapaneseMatch('kōhī', 'コーヒー').isMatch).toBe(true);
    expect(isJapaneseMatch('koohii', 'コーヒー').isMatch).toBe(true);
    // Short vowel should not falsely match long vowel
    expect(isJapaneseMatch('oki', 'おおきい').isMatch).toBe(false);
  });

  it("handles small tsu (っ) and syllabic ん / n'", () => {
    expect(isJapaneseMatch('kitte', 'きって').isMatch).toBe(true);
    expect(isJapaneseMatch('kite', 'きって').isMatch).toBe(false);
    expect(isJapaneseMatch("hon'ya", 'ほんや').isMatch).toBe(true);
    expect(isJapaneseMatch('honya', 'ほんや').isMatch).toBe(false);
    expect(isJapaneseMatch("nihon'", 'にほん').isMatch).toBe(true);
  });

  it('prefers Japanese distractors with the same wordType and similar kana length', () => {
    const target = makeJaCard({ id: 't', kana: 'たべる', wordType: 'verb', meaning: 'ăn' });
    const pool: Card[] = [
      makeJaCard({ id: 'v1', kana: 'のむ', wordType: 'verb', meaning: 'uống' }),
      makeJaCard({ id: 'v2', kana: 'みる', wordType: 'verb', meaning: 'xem' }),
      makeJaCard({ id: 'v3', kana: 'きく', wordType: 'verb', meaning: 'nghe' }),
      makeJaCard({ id: 'n1', kana: 'みず', wordType: 'noun', meaning: 'nước' }),
      makeJaCard({ id: 'n2', kana: 'ともだち', wordType: 'noun', meaning: 'bạn bè' }),
    ];

    const picked = pickJapaneseQuizDistractors(target, pool, 3);
    expect(picked).toHaveLength(3);
    expect(picked.every((c) => c.wordType === 'verb')).toBe(true);
  });

  it('builds Anki Japanese import preset mappings', () => {
    expect(buildJapanesePresetMapping(4, 'anki_ja_basic')).toEqual([
      'kana',
      'romaji',
      'meaning',
      'lesson',
    ]);
  });
});

describe('Kanji hidden by default', () => {
  it('hides kanji when showKanji is false (default) and renders ruby furigana when true', () => {
    const card = makeJaCard();
    const { rerender } = render(<JapaneseTerm card={card} />);
    expect(screen.getByText('たべる')).toBeInTheDocument();
    expect(screen.queryByText('食べる')).not.toBeInTheDocument();

    rerender(<JapaneseTerm card={card} showKanji={true} />);
    expect(screen.getByText('食べる')).toBeInTheDocument();
    expect(screen.getByText('たべる').tagName.toLowerCase()).toBe('rt');
  });
});

describe('Dexie v1 -> v2 migration', () => {
  it('preserves existing v1 decks/cards/settings and defaults deck language to en', async () => {
    const dbName = `LexiCardsMigrationTest_${Date.now()}`;

    // Create v1 database with legacy data
    const v1Db = new Dexie(dbName);
    v1Db.version(1).stores({
      decks: 'id, name, createdAt, updatedAt, *tags',
      cards: 'id, deckId, term, status, dueDate, createdAt, *tags',
      reviewLogs: 'id, cardId, deckId, reviewedAt, mode',
      settings: 'id',
    });
    await v1Db.open();
    await v1Db.table('decks').put({
      id: 'legacy_deck',
      name: 'Legacy English',
      description: 'Old deck',
      color: '#4f46e5',
      emoji: '📘',
      tags: ['old'],
      createdAt: 1000,
      updatedAt: 1000,
    });
    await v1Db.table('cards').put({
      id: 'legacy_card',
      deckId: 'legacy_deck',
      term: 'resilient',
      meaning: 'kiên cường',
      phonetic: '/rɪˈzɪliənt/',
      partOfSpeech: 'adjective',
      example: '',
      exampleTranslation: '',
      notes: '',
      imageUrl: '',
      tags: [],
      easeFactor: 2.5,
      interval: 6,
      repetitions: 2,
      lapses: 0,
      status: 'review',
      dueDate: 2000,
      lastReviewedAt: 1500,
      createdAt: 1000,
      updatedAt: 1500,
    });
    await v1Db.table('settings').put({
      id: 'default',
      language: 'vi',
      theme: 'dark',
      dailyNewLimit: 15,
      dailyGoal: 30,
      ttsVoiceURI: '',
      ttsLang: 'en-US',
      ttsRate: 1.0,
      remindersEnabled: false,
      reminderTime: '20:00',
      aiEnabled: false,
      aiApiKey: '',
      aiEndpoint: '',
      aiModel: '',
      onboardingCompleted: true,
      xp: 120,
      unlockedBadges: ['first_review'],
    });
    v1Db.close();

    // Open same database using v2 schema
    const v2Db = new LexiCardsDatabase(dbName);
    await v2Db.open();

    const migratedDeck = await v2Db.decks.get('legacy_deck');
    const migratedCard = await v2Db.cards.get('legacy_card');
    const migratedSettings = await v2Db.settings.get('default');

    expect(migratedDeck?.name).toBe('Legacy English');
    expect(migratedDeck?.language).toBe('en');
    expect(migratedCard?.term).toBe('resilient');
    expect(migratedCard?.interval).toBe(6);
    expect(migratedSettings?.xp).toBe(120);
    expect(migratedSettings?.showKanji).toBe(false);
    expect(migratedSettings?.ttsAutoplay).toBe(false);

    v2Db.close();
    await Dexie.delete(dbName);
  });
});
