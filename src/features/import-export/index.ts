import { db } from '@/db';
import { bulkCreateCards, createDeck } from '@/db/actions';
import { kanaToRomaji } from '@/features/japanese';
import { createInitialSRSFields } from '@/features/srs/sm2';
import type {
  Card,
  Deck,
  DeckLanguage,
  FullBackupPayload,
  ReviewLog,
  UserSettings,
  VerbForms,
} from '@/types';

export type ImportFormat = 'csv' | 'tsv' | 'json';

export type MappableField =
  | 'ignore'
  | 'term'
  | 'meaning'
  | 'phonetic'
  | 'partOfSpeech'
  | 'example'
  | 'exampleTranslation'
  | 'notes'
  | 'tags'
  | 'kana'
  | 'romaji'
  | 'kanji'
  | 'wordType'
  | 'lesson'
  | 'masu'
  | 'te'
  | 'ta'
  | 'nai';

export interface ParsedImportTable {
  format: ImportFormat;
  headers: string[];
  rows: string[][];
  suggestedMapping: MappableField[];
}

const FIELD_ALIASES: Record<Exclude<MappableField, 'ignore'>, string[]> = {
  term: ['term', 'word', 'front', 'english', 'vocabulary', 'vocab', 'tu', 'từ'],
  meaning: ['meaning', 'definition', 'back', 'vietnamese', 'translation', 'nghia', 'nghĩa'],
  phonetic: ['phonetic', 'ipa', 'pronunciation', 'phien am', 'phiên âm'],
  partOfSpeech: ['pos', 'partofspeech', 'part_of_speech', 'type', 'tu loai', 'từ loại'],
  example: ['example', 'sentence', 'vi du', 'ví dụ'],
  exampleTranslation: ['exampletranslation', 'example_translation', 'dich vi du', 'dịch ví dụ'],
  notes: ['notes', 'note', 'ghi chu', 'ghi chú'],
  tags: ['tags', 'tag', 'label', 'labels'],
  kana: ['kana', 'hiragana', 'katakana', 'reading', 'furigana'],
  romaji: ['romaji', 'romanji', 'latin'],
  kanji: ['kanji', 'hanzi', 'han tu', 'hán tự'],
  wordType: ['wordtype', 'word_type', 'jlpt_pos', 'loai tu', 'loại từ'],
  lesson: ['lesson', 'bai', 'bài', 'unit', 'chapter'],
  masu: ['masu', 'masuform', 'masu_form'],
  te: ['te', 'teform', 'te_form'],
  ta: ['ta', 'taform', 'ta_form'],
  nai: ['nai', 'naiform', 'nai_form'],
};

function guessField(header: string, colIndex: number): MappableField {
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '');
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalized === alias.replace(/[\s-]+/g, ''))) {
      return field as MappableField;
    }
  }
  if (colIndex === 0) return 'term';
  if (colIndex === 1) return 'meaning';
  if (colIndex === 2) return 'phonetic';
  if (colIndex === 3) return 'example';
  return 'ignore';
}

export function buildJapanesePresetMapping(
  columnCount: number,
  preset: 'anki_ja_basic' | 'anki_ja_full'
): MappableField[] {
  const basicOrder: MappableField[] = ['kana', 'romaji', 'meaning', 'lesson', 'kanji', 'notes'];
  const fullOrder: MappableField[] = [
    'kana',
    'kanji',
    'romaji',
    'meaning',
    'wordType',
    'lesson',
    'example',
    'exampleTranslation',
  ];
  const template = preset === 'anki_ja_basic' ? basicOrder : fullOrder;
  return Array.from({ length: columnCount }, (_, i) => template[i] ?? 'ignore');
}

export function parseDelimitedText(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const clean = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) {
    rows.push(row);
  }
  return rows;
}

export function parseImportFile(filename: string, content: string): ParsedImportTable {
  const lower = filename.toLowerCase();
  const trimmed = content.trim();

  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    const records: Array<Record<string, unknown>> = Array.isArray(parsed)
      ? (parsed as Array<Record<string, unknown>>)
      : typeof parsed === 'object' &&
          parsed !== null &&
          'cards' in parsed &&
          Array.isArray((parsed as { cards: unknown[] }).cards)
        ? (parsed as { cards: Array<Record<string, unknown>> }).cards
        : [];

    if (records.length === 0) {
      return { format: 'json', headers: [], rows: [], suggestedMapping: [] };
    }

    const allowedKeys = [
      'term',
      'meaning',
      'phonetic',
      'partOfSpeech',
      'example',
      'exampleTranslation',
      'notes',
      'tags',
      'front',
      'back',
      'kana',
      'romaji',
      'kanji',
      'wordType',
      'lesson',
    ];
    const keySet = new Set<string>();
    records.forEach((r) => {
      if (r && typeof r === 'object') {
        Object.keys(r).forEach((k) => {
          if (allowedKeys.includes(k)) {
            keySet.add(k);
          }
        });
      }
    });

    const headers = Array.from(keySet);
    const rows = records.map((r) =>
      headers.map((h) => {
        const val = r[h];
        if (Array.isArray(val)) return val.join(', ');
        return typeof val === 'string' || typeof val === 'number' ? String(val) : '';
      })
    );

    return {
      format: 'json',
      headers,
      rows,
      suggestedMapping: headers.map((h, i) => guessField(h, i)),
    };
  }

  const isTsv =
    lower.endsWith('.tsv') ||
    lower.endsWith('.txt') ||
    (!lower.endsWith('.csv') && content.includes('\t'));

  const delimiter: ',' | '\t' = isTsv ? '\t' : ',';
  const rawRows = parseDelimitedText(content, delimiter);
  if (rawRows.length === 0) {
    return { format: isTsv ? 'tsv' : 'csv', headers: [], rows: [], suggestedMapping: [] };
  }

  const firstRow = rawRows[0];
  const looksLikeHeader = firstRow.some((cell) => {
    const c = cell.trim().toLowerCase();
    return [
      'term',
      'word',
      'front',
      'meaning',
      'back',
      'phonetic',
      'ipa',
      'example',
      'kana',
      'romaji',
      'kanji',
      'lesson',
    ].includes(c);
  });

  const headers = looksLikeHeader ? firstRow : firstRow.map((_, idx) => `Column ${idx + 1}`);
  const dataRows = looksLikeHeader ? rawRows.slice(1) : rawRows;

  return {
    format: isTsv ? 'tsv' : 'csv',
    headers,
    rows: dataRows,
    suggestedMapping: headers.map((h, i) => guessField(h, i)),
  };
}

export async function commitMappedImport(
  deckId: string,
  rows: string[][],
  mapping: MappableField[],
  duplicateStrategy: 'skip' | 'update' | 'keep'
): Promise<{ added: number; updated: number; skipped: number }> {
  const items = rows.map((row) => {
    const obj: {
      term: string;
      meaning: string;
      phonetic: string;
      partOfSpeech: string;
      example: string;
      exampleTranslation: string;
      notes: string;
      tags: string[];
      kana?: string;
      romaji?: string;
      kanji?: string;
      wordType?: string;
      lesson?: number;
      verbForms?: VerbForms;
    } = {
      term: '',
      meaning: '',
      phonetic: '',
      partOfSpeech: '',
      example: '',
      exampleTranslation: '',
      notes: '',
      tags: [],
    };

    const verbForms: VerbForms = {};

    mapping.forEach((field, idx) => {
      const value = (row[idx] ?? '').trim();
      if (!value || field === 'ignore') return;
      if (field === 'tags') {
        obj.tags = value
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (field === 'lesson') {
        const num = Number(value.replace(/[^\d]/g, ''));
        if (num > 0) obj.lesson = Math.min(50, num);
      } else if (field === 'masu' || field === 'te' || field === 'ta' || field === 'nai') {
        verbForms[field] = value;
      } else {
        obj[field] = value;
      }
    });

    if (obj.kana && !obj.term) {
      obj.term = obj.kana;
    }
    if (obj.kana && !obj.romaji) {
      obj.romaji = kanaToRomaji(obj.kana);
    }
    if (obj.romaji && !obj.phonetic) {
      obj.phonetic = obj.romaji;
    }
    if (obj.wordType && !obj.partOfSpeech) {
      obj.partOfSpeech = obj.wordType;
    }
    if (verbForms.masu || verbForms.te || verbForms.ta || verbForms.nai) {
      obj.verbForms = verbForms;
    }

    return obj;
  });

  return bulkCreateCards(deckId, items, duplicateStrategy);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportCardsToCSV(cards: Card[]): string {
  const headers = [
    'term',
    'meaning',
    'phonetic',
    'partOfSpeech',
    'example',
    'exampleTranslation',
    'notes',
    'tags',
    'kana',
    'romaji',
    'kanji',
    'wordType',
    'lesson',
  ];
  const lines = [
    headers.join(','),
    ...cards.map((c) =>
      [
        c.term,
        c.meaning,
        c.phonetic,
        c.partOfSpeech,
        c.example,
        c.exampleTranslation,
        c.notes,
        c.tags.join('; '),
        c.kana ?? '',
        c.romaji ?? '',
        c.kanji ?? '',
        c.wordType ?? '',
        c.lesson ? String(c.lesson) : '',
      ]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];
  return lines.join('\n');
}

export function exportCardsToAnkiTSV(cards: Card[]): string {
  return cards
    .map((c) =>
      [
        c.kana || c.term,
        c.meaning,
        c.romaji || c.phonetic,
        c.wordType || c.partOfSpeech,
        c.example,
        c.exampleTranslation,
        c.notes,
        c.lesson ? String(c.lesson) : '',
        c.kanji ?? '',
        c.tags.join(' '),
      ]
        .map((v) => v.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>'))
        .join('\t')
    )
    .join('\n');
}

export async function exportFullBackup(): Promise<FullBackupPayload> {
  const [decks, cards, reviewLogs, settings] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviewLogs.toArray(),
    db.settings.get('default'),
  ]);

  const safeSettings: Partial<UserSettings> | undefined = settings
    ? { ...settings, aiApiKey: '', elevenLabsApiKey: '' }
    : undefined;

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
    reviewLogs,
    settings: safeSettings,
  };
}

export function isFullBackupPayload(data: unknown): data is FullBackupPayload {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Partial<FullBackupPayload>;
  return Array.isArray(obj.decks) && Array.isArray(obj.cards);
}

export async function restoreFullBackup(payload: FullBackupPayload): Promise<{
  decksRestored: number;
  cardsRestored: number;
  logsRestored: number;
}> {
  const now = Date.now();
  const validDecks: Deck[] = payload.decks.map((d) => ({
    id: d.id,
    name: d.name || 'Imported Deck',
    description: d.description ?? '',
    color: d.color || '#4f46e5',
    emoji: d.emoji || (d.language === 'ja' ? '🇯🇵' : '📚'),
    language: d.language === 'ja' ? 'ja' : 'en',
    tags: Array.isArray(d.tags) ? d.tags : [],
    createdAt: d.createdAt ?? now,
    updatedAt: d.updatedAt ?? now,
  }));

  const validCards: Card[] = payload.cards.map((c) => ({
    ...createInitialSRSFields(now),
    ...c,
    tags: Array.isArray(c.tags) ? c.tags : [],
  }));

  const validLogs: ReviewLog[] = Array.isArray(payload.reviewLogs) ? payload.reviewLogs : [];

  await db.transaction('rw', db.decks, db.cards, db.reviewLogs, db.settings, async () => {
    await db.decks.clear();
    await db.cards.clear();
    await db.reviewLogs.clear();

    if (validDecks.length > 0) await db.decks.bulkPut(validDecks);
    if (validCards.length > 0) await db.cards.bulkPut(validCards);
    if (validLogs.length > 0) await db.reviewLogs.bulkPut(validLogs);

    if (payload.settings) {
      const current = await db.settings.get('default');
      if (current) {
        await db.settings.put({
          ...current,
          ...payload.settings,
          showKanji: payload.settings.showKanji ?? current.showKanji ?? false,
          ttsAutoplay: payload.settings.ttsAutoplay ?? current.ttsAutoplay ?? false,
          id: 'default',
          aiApiKey: current.aiApiKey,
          elevenLabsApiKey: current.elevenLabsApiKey,
        });
      }
    }
  });

  return {
    decksRestored: validDecks.length,
    cardsRestored: validCards.length,
    logsRestored: validLogs.length,
  };
}

export async function ensureTargetDeck(
  deckId: string,
  newDeckName?: string,
  language: DeckLanguage = 'en'
): Promise<string> {
  if (deckId !== '__new__') return deckId;
  const created = await createDeck({
    name: newDeckName?.trim() || 'Imported Vocabulary',
    emoji: language === 'ja' ? '🇯🇵' : '📥',
    color: language === 'ja' ? '#ec4899' : '#0ea5e9',
    language,
    description: 'Imported deck',
  });
  return created.id;
}
