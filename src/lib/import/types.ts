import type { DeckLanguage, JapaneseWordType, VerbForms } from '@/types';

export type PasteFormat = 'auto' | 'lines' | 'csv' | 'tsv' | 'json' | 'anki' | 'markdown';

export type DetectedFormat = Exclude<PasteFormat, 'auto'>;

export type LineSeparator = '\t' | ' - ' | ' = ' | ';' | '|' | ',' | ':';

export type PasteDuplicateStrategy = 'skip' | 'overwrite' | 'keep';

export type ImportField =
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

export type RowIssueCode =
  | 'empty_term'
  | 'empty_meaning'
  | 'duplicate_in_paste'
  | 'duplicate_in_deck'
  | 'field_too_long'
  | 'missing_kana_for_kanji'
  | 'json_validation';

export interface RowIssue {
  severity: 'error' | 'warning';
  code: RowIssueCode;
  field?: string;
  message: string;
}

export interface ParsedCardRow {
  rowId: string;
  rowIndex: number;
  term: string;
  meaning: string;
  kana: string;
  romaji: string;
  kanji: string;
  phonetic: string;
  partOfSpeech: string;
  wordType?: JapaneseWordType;
  lesson?: number;
  example: string;
  exampleTranslation: string;
  notes: string;
  tags: string[];
  verbForms?: VerbForms;
  rawColumns?: string[];
  aiSuggested?: boolean;
  issues: RowIssue[];
  isDuplicateInPaste: boolean;
  isDuplicateInDeck: boolean;
  existingCardId?: string;
  hasError: boolean;
}

export interface PasteParseError {
  path?: string;
  line?: number;
  message: string;
}

export interface ValidationTotals {
  total: number;
  valid: number;
  duplicates: number;
  inPasteDuplicates: number;
  inDeckDuplicates: number;
  errors: number;
  warnings: number;
}

export interface PasteParseResult {
  detectedFormat: DetectedFormat;
  detectedSeparator?: LineSeparator;
  detectedLanguage: DeckLanguage;
  suggestedDeckName?: string;
  hasColumns: boolean;
  headers: string[];
  columnMapping: ImportField[];
  rows: ParsedCardRow[];
  parseErrors: PasteParseError[];
  totals: ValidationTotals;
}

export interface ParseOptions {
  format?: PasteFormat;
  separator?: LineSeparator;
  languageOverride?: DeckLanguage;
  columnMappingOverride?: ImportField[];
  batchLesson?: number;
  batchTags?: string[];
  existingCards?: Array<{ id: string; term: string; kana?: string; kanji?: string }>;
  onProgress?: (progress: number) => void;
}
