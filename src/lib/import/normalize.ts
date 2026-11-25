import type { DeckLanguage, JapaneseWordType } from '@/types';
import type { ParsedCardRow } from './types';

export const MAX_PASTE_BYTES = 5 * 1024 * 1024;
export const MAX_FIELD_LENGTH = 500;
export const MAX_LONG_FIELD_LENGTH = 1000;
export const CHUNK_SIZE = 300;

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  copy: '©',
  reg: '®',
  laquo: '«',
  raquo: '»',
};

const VALID_WORD_TYPES: ReadonlySet<JapaneseWordType> = new Set([
  'noun',
  'verb',
  'i-adj',
  'na-adj',
  'adverb',
  'particle',
  'expression',
]);

/**
 * Normalize Unicode to NFC, unify newlines, strip zero-width chars, and replace full-width spaces.
 */
export function normalizeUnicodeAndSpaces(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u3000/g, ' ');
}

/**
 * Convert full-width ASCII delimiters (except katakana prolonged sound mark U+30FC) to half-width equivalents.
 */
export function normalizeDelimiterPunctuation(input: string): string {
  return normalizeUnicodeAndSpaces(input)
    .replace(/\uFF0C/g, ',')
    .replace(/\uFF1B/g, ';')
    .replace(/\uFF1A/g, ':')
    .replace(/\uFF5C/g, '|')
    .replace(/\uFF1D/g, '=')
    .replace(/\uFF0D/g, '-');
}

/**
 * Pure, DOM-free HTML stripper and entity decoder.
 * Treats input strictly as data — never executes scripts or touches live DOM innerHTML.
 */
export function stripHtmlAndDecodeEntities(raw: string): string {
  if (!raw) return '';

  const withLineBreaks = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, '');

  const decoded = withoutTags
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
      return '';
    })
    .replace(/&#(\d+);/g, (_match, dec: string) => {
      const code = Number.parseInt(dec, 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
      return '';
    })
    .replace(
      /&([a-zA-Z]+);/g,
      (match, name: string) => HTML_ENTITY_MAP[name.toLowerCase()] ?? match
    );

  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitize pasted cell text for safe storage and plain-text rendering.
 */
export function sanitizeCell(raw: string): string {
  return normalizeUnicodeAndSpaces(stripHtmlAndDecodeEntities(raw)).trim();
}

export function normalizeTags(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw.flatMap((part) => part.split(/[,;、]/))
    : raw.split(/[,;、]/);
  const unique = new Set<string>();
  for (const item of items) {
    const cleaned = sanitizeCell(item);
    if (cleaned) unique.add(cleaned);
  }
  return Array.from(unique);
}

export function parseLessonValue(raw: string | number | undefined): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const int = Math.round(raw);
    return int >= 1 && int <= 50 ? int : undefined;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const match = raw.match(/\d+/);
    if (!match) return undefined;
    const int = Number.parseInt(match[0], 10);
    return int >= 1 && int <= 50 ? int : undefined;
  }
  return undefined;
}

export function normalizeWordTypeValue(raw: string | undefined): JapaneseWordType | undefined {
  if (!raw) return undefined;
  const cleaned = sanitizeCell(raw).toLowerCase();
  if (VALID_WORD_TYPES.has(cleaned as JapaneseWordType)) {
    return cleaned as JapaneseWordType;
  }
  if (cleaned === 'i_adj' || cleaned === 'iadj' || cleaned === 'i-adjective') return 'i-adj';
  if (cleaned === 'na_adj' || cleaned === 'naadj' || cleaned === 'na-adjective') return 'na-adj';
  if (cleaned === 'v' || cleaned.startsWith('verb')) return 'verb';
  if (cleaned === 'n' || cleaned === 'noun') return 'noun';
  if (cleaned === 'adv' || cleaned === 'adverb') return 'adverb';
  return undefined;
}

const JAPANESE_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3005]/;
const KANJI_CHAR_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3005]/;
const KANA_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF]/;

export function containsJapanese(text: string): boolean {
  return JAPANESE_CHAR_RE.test(text);
}

export function containsKanji(text: string): boolean {
  return KANJI_CHAR_RE.test(text);
}

export function containsKana(text: string): boolean {
  return KANA_CHAR_RE.test(text);
}

export function isRomajiOnlyTerm(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || containsJapanese(trimmed)) return false;
  return /^[a-zA-ZāīūēōâîûêôĀĪŪĒŌÂÎÛÊÔ'\-\s]+$/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}

/**
 * Auto-detect deck language from parsed rows.
 */
export function suggestDeckLanguage(
  rows: ReadonlyArray<Pick<ParsedCardRow, 'term' | 'kana' | 'kanji'>>
): DeckLanguage {
  const sample = rows.slice(0, 100);
  if (sample.length === 0) return 'en';

  let japaneseCount = 0;
  let evaluated = 0;

  for (const row of sample) {
    const primary = `${row.term} ${row.kana} ${row.kanji}`.trim();
    if (!primary) continue;
    evaluated++;
    if (containsJapanese(primary)) {
      japaneseCount++;
    }
  }

  if (evaluated === 0) return 'en';
  return japaneseCount * 2 >= evaluated ? 'ja' : 'en';
}

const ANKI_DIRECTIVE_RE =
  /^#(separator|html|columns|guid column|notetype column|deck column|tags column|deck|notetype|tags):/i;

/**
 * Extract optional `# Deck Title` on the first non-empty line (ignoring Anki `#directive:` headers).
 */
export function extractDeckTitleAndBody(rawText: string): {
  suggestedDeckName?: string;
  bodyText: string;
} {
  const normalized = normalizeUnicodeAndSpaces(rawText);
  const lines = normalized.split('\n');
  let suggestedDeckName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#') && !ANKI_DIRECTIVE_RE.test(trimmed)) {
      const candidate = sanitizeCell(trimmed.replace(/^#+\s*/, ''));
      if (candidate) {
        suggestedDeckName = candidate;
      }
      const remaining = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
      return { suggestedDeckName, bodyText: remaining };
    }

    if (ANKI_DIRECTIVE_RE.test(trimmed)) {
      const deckMatch = trimmed.match(/^#deck:(.+)$/i);
      if (deckMatch) {
        const candidate = sanitizeCell(deckMatch[1]);
        if (candidate) suggestedDeckName = candidate;
      }
      continue;
    }

    break;
  }

  return { suggestedDeckName, bodyText: normalized };
}

export function formatDefaultDeckName(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `Bộ thẻ mới ${yyyy}-${mm}-${dd}`;
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
