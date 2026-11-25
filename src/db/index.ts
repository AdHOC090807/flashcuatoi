import Dexie, { type EntityTable } from 'dexie';
import type { Card, Deck, ReviewLog, UserSettings } from '@/types';

export class LexiCardsDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  settings!: EntityTable<UserSettings, 'id'>;

  constructor(name = 'LexiCardsDB') {
    super(name);
    this.version(1).stores({
      decks: 'id, name, createdAt, updatedAt, *tags',
      cards: 'id, deckId, term, status, dueDate, createdAt, *tags',
      reviewLogs: 'id, cardId, deckId, reviewedAt, mode',
      settings: 'id',
    });

    this.version(2)
      .stores({
        decks: 'id, name, language, createdAt, updatedAt, *tags',
        cards: 'id, deckId, term, status, dueDate, createdAt, lesson, *tags',
        reviewLogs: 'id, cardId, deckId, reviewedAt, mode',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('decks')
          .toCollection()
          .modify((deck: Partial<Deck>) => {
            if (!deck.language) {
              deck.language = 'en';
            }
          });

        await tx
          .table('settings')
          .toCollection()
          .modify((setting: Partial<UserSettings>) => {
            if (setting.showKanji === undefined) {
              setting.showKanji = false;
            }
            if (setting.ttsAutoplay === undefined) {
              setting.ttsAutoplay = false;
            }
          });
      });
  }
}

export const db = new LexiCardsDatabase();

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'default',
  language: 'en',
  theme: 'system',
  dailyNewLimit: 20,
  dailyGoal: 25,
  ttsVoiceURI: '',
  ttsLang: 'en-US',
  ttsRate: 1.0,
  ttsAutoplay: false,
  showKanji: false,
  remindersEnabled: false,
  reminderTime: '20:00',
  aiEnabled: false,
  aiApiKey: '',
  aiEndpoint: 'https://api.openai.com/v1/chat/completions',
  aiModel: 'gpt-4o-mini',
  onboardingCompleted: false,
  xp: 0,
  unlockedBadges: [],
};

export async function getOrCreateSettings(): Promise<UserSettings> {
  const existing = await db.settings.get('default');
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
