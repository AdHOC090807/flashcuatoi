import Papa from 'papaparse';
import { normalizeDelimiterPunctuation, normalizeUnicodeAndSpaces } from './normalize';
import type { DetectedFormat, ImportField, LineSeparator } from './types';

export const SUPPORTED_LINE_SEPARATORS: readonly LineSeparator[] = [
  '\t',
  ' - ',
  ' = ',
  ';',
  '|',
  ',',
  ':',
];

const HEADER_ALIASES: Record<string, ImportField> = {
  term: 'term',
  word: 'term',
  front: 'term',
  question: 'term',
  vocabulary: 'term',
  english: 'term',
  meaning: 'meaning',
  definition: 'meaning',
  back: 'meaning',
  answer: 'meaning',
  vietnamese: 'meaning',
  nghia: 'meaning',
  kana: 'kana',
  hiragana: 'kana',
  katakana: 'kana',
  reading: 'kana',
  romaji: 'romaji',
  kanji: 'kanji',
  phonetic: 'phonetic',
  ipa: 'phonetic',
  pos: 'partOfSpeech',
  partofspeech: 'partOfSpeech',
  wordtype: 'wordType',
  type: 'wordType',
  lesson: 'lesson',
  bai: 'lesson',
  example: 'example',
  sentence: 'example',
  translation: 'exampleTranslation',
  exampletranslation: 'exampleTranslation',
  notes: 'notes',
  note: 'notes',
  tags: 'tags',
  tag: 'tags',
  masu: 'masu',
  te: 'te',
  ta: 'ta',
  nai: 'nai',
};

export function normalizeHeaderKey(header: string): string {
  return normalizeUnicodeAndSpaces(header)
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function mapHeaderToImportField(header: string): ImportField {
  return HEADER_ALIASES[normalizeHeaderKey(header)] ?? 'ignore';
}

const ANKI_HEADER_RE =
  /^#(separator|html|columns|guid column|notetype column|deck column|tags column|deck|notetype|tags):/i;

const MARKDOWN_DIVIDER_RE = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

function isKnownHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  let knownCount = 0;
  for (const cell of cells) {
    if (mapHeaderToImportField(cell) !== 'ignore') {
      knownCount++;
    }
  }
  return knownCount >= 2;
}

/**
 * Split a line only on the first occurrence of separator.
 * Accounts for equivalent full-width delimiter characters.
 */
export function splitOnFirstSeparator(
  line: string,
  separator: LineSeparator
): [string, string] | null {
  const cleanLine = normalizeUnicodeAndSpaces(line);
  const normalizedForMatch = normalizeDelimiterPunctuation(cleanLine);
  if (separator === ' - ') {
    const idx = normalizedForMatch.indexOf(' - ');
    if (idx === -1) return null;
    return [cleanLine.slice(0, idx), cleanLine.slice(idx + 3)];
  }
  if (separator === ' = ') {
    const idx = normalizedForMatch.indexOf(' = ');
    if (idx !== -1) {
      return [cleanLine.slice(0, idx), cleanLine.slice(idx + 3)];
    }
    const bareIdx = normalizedForMatch.indexOf('=');
    if (bareIdx === -1) return null;
    return [cleanLine.slice(0, bareIdx), cleanLine.slice(bareIdx + 1)];
  }
  if (separator === ':') {
    // Prefer " : " or ": " or bare ":" while ignoring http:// or https:// protocol colons
    const spacedIdx = normalizedForMatch.indexOf(': ');
    if (spacedIdx !== -1 && !/^https?$/i.test(normalizedForMatch.slice(0, spacedIdx).trim())) {
      return [cleanLine.slice(0, spacedIdx), cleanLine.slice(spacedIdx + 2)];
    }
    const rawIdx = normalizedForMatch.indexOf(':');
    if (rawIdx === -1) return null;
    if (/^https?$/i.test(normalizedForMatch.slice(0, rawIdx).trim())) {
      return null;
    }
    return [cleanLine.slice(0, rawIdx), cleanLine.slice(rawIdx + 1)];
  }

  const idx = normalizedForMatch.indexOf(separator);
  if (idx === -1) return null;
  return [cleanLine.slice(0, idx), cleanLine.slice(idx + separator.length)];
}

/**
 * Auto-detect the most consistent line separator across non-empty lines.
 */
export function detectLineSeparator(lines: string[]): LineSeparator {
  const sample = lines.filter((l) => l.trim().length > 0).slice(0, 60);
  if (sample.length === 0) return ' - ';

  let bestSep: LineSeparator = ' - ';
  let bestScore = -1;

  for (let order = 0; order < SUPPORTED_LINE_SEPARATORS.length; order++) {
    const sep = SUPPORTED_LINE_SEPARATORS[order];
    let validMatches = 0;

    for (const line of sample) {
      const split = splitOnFirstSeparator(line, sep);
      if (split && split[0].trim() && split[1].trim()) {
        validMatches++;
      }
    }

    if (validMatches === 0) continue;

    // Slightly favor earlier higher-precedence separators when coverage matches
    const score = validMatches * 100 - order;
    if (score > bestScore) {
      bestScore = score;
      bestSep = sep;
    }
  }

  return bestSep;
}

/**
 * Auto-detect pasted format from raw text content.
 */
export function detectFormat(rawText: string): DetectedFormat {
  const normalized = normalizeUnicodeAndSpaces(rawText).trim();
  if (!normalized) return 'lines';

  if (normalized.startsWith('{') || normalized.startsWith('[')) {
    return 'json';
  }

  const lines = normalized.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return 'lines';

  // Anki metadata directives
  if (nonEmpty.slice(0, 10).some((line) => ANKI_HEADER_RE.test(line.trim()))) {
    return 'anki';
  }

  // Markdown table detection
  const hasDivider = nonEmpty.slice(0, 12).some((line) => MARKDOWN_DIVIDER_RE.test(line));
  const pipeLines = nonEmpty
    .slice(0, 12)
    .filter((line) => line.trim().startsWith('|') && line.trim().endsWith('|')).length;
  if (hasDivider && pipeLines >= 2) {
    return 'markdown';
  }

  // Check TSV header row with papaparse
  const firstSample = nonEmpty.slice(0, 20).join('\n');
  if (nonEmpty[0].includes('\t')) {
    const tsvProbe = Papa.parse<string[]>(firstSample, { delimiter: '\t', skipEmptyLines: true });
    if (tsvProbe.data.length > 0 && isKnownHeaderRow(tsvProbe.data[0])) {
      return 'tsv';
    }
  }

  // Check CSV header row or multi-line quoted CSV via papaparse
  const csvProbe = Papa.parse<string[]>(firstSample, { delimiter: ',', skipEmptyLines: true });
  if (csvProbe.data.length > 0 && isKnownHeaderRow(csvProbe.data[0])) {
    return 'csv';
  }

  // Detect quoted CSV with embedded newlines even if custom headers aren't in alias list
  const hasQuotes = nonEmpty.some((l) => l.includes('"'));
  if (hasQuotes && csvProbe.data.length > 0 && csvProbe.data[0].length >= 2) {
    // If joining physical lines yielded fewer parsed records than lines starting with quotes, it's multi-line CSV
    const unclosedQuoteLine = nonEmpty.some((line) => (line.match(/"/g)?.length ?? 0) % 2 === 1);
    if (unclosedQuoteLine && csvProbe.errors.length === 0) {
      return 'csv';
    }
  }

  return 'lines';
}
