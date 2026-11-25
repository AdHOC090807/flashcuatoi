export type CardStatus = 'new' | 'learning' | 'review';

export type ReviewRating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

export type StudyMode = 'flip' | 'quiz' | 'typing' | 'match' | 'listen' | 'conjugation';

export type StudyDirection = 'term_to_meaning' | 'meaning_to_term' | 'listen_to_term';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AppLanguage = 'en' | 'vi';

export type DeckLanguage = 'en' | 'ja';

export type TTSProviderType = 'proxy' | 'webspeech' | 'elevenlabs_byok';

export interface TTSCacheEntry {
  key: string;
  mimeType: string;
  data: ArrayBuffer;
  createdAt: number;
}

export type JapaneseWordType =
  'verb' | 'i-adj' | 'na-adj' | 'noun' | 'adverb' | 'particle' | 'expression';

export interface VerbForms {
  masu?: string;
  te?: string;
  ta?: string;
  nai?: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  emoji: string;
  language: DeckLanguage;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  term: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  notes: string;
  imageUrl: string;
  audioUrl?: string;
  tags: string[];
  // Optional Japanese-specific fields
  kana?: string;
  romaji?: string;
  kanji?: string;
  wordType?: JapaneseWordType | string;
  lesson?: number;
  verbForms?: VerbForms;
  // SM-2 SRS fields
  easeFactor: number;
  interval: number; // in days
  repetitions: number;
  lapses: number;
  status: CardStatus;
  dueDate: number; // epoch ms
  lastReviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  rating: ReviewRating;
  mode: StudyMode;
  correct: boolean;
  elapsedMs: number;
  previousInterval: number;
  newInterval: number;
  reviewedAt: number;
}

export interface UserSettings {
  id: 'default';
  language: AppLanguage;
  theme: ThemeMode;
  dailyNewLimit: number;
  dailyGoal: number;
  ttsVoiceURI: string;
  ttsLang: string;
  ttsRate: number;
  ttsAutoplay: boolean;
  ttsProvider?: TTSProviderType;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModel?: string;
  showKanji: boolean;
  remindersEnabled: boolean;
  reminderTime: string; // HH:mm
  aiEnabled: boolean;
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
  onboardingCompleted: boolean;
  xp: number;
  unlockedBadges: string[];
}

export interface DeckCounts {
  newCount: number;
  learningCount: number;
  dueCount: number;
  totalCount: number;
  masteredCount: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

export interface BadgeDefinition {
  id: string;
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

export interface FullBackupPayload {
  version: number;
  exportedAt: string;
  decks: Array<Omit<Deck, 'language'> & { language?: DeckLanguage }>;
  cards: Card[];
  reviewLogs: ReviewLog[];
  settings?: Partial<UserSettings>;
}
