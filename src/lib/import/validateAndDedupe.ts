import { normalizeText } from '@/lib/utils';
import type { DeckLanguage } from '@/types';
import { MAX_FIELD_LENGTH, MAX_LONG_FIELD_LENGTH, containsKanji } from './normalize';
import type { ParsedCardRow, RowIssue, ValidationTotals } from './types';

export function buildCardMatchKey(
  item: { term: string; kana?: string },
  language: DeckLanguage
): string {
  const base = language === 'ja' ? item.kana?.trim() || item.term.trim() : item.term.trim();
  if (!base) return '';
  if (language === 'ja') {
    return base.normalize('NFC').trim().toLowerCase();
  }
  return normalizeText(base) || base.normalize('NFC').trim().toLowerCase();
}

export function validateAndDedupeRows(
  rows: ParsedCardRow[],
  options: {
    language: DeckLanguage;
    existingCards?: Array<{ id: string; term: string; kana?: string; kanji?: string }>;
  }
): { rows: ParsedCardRow[]; totals: ValidationTotals } {
  const existingMap = new Map<string, string>();
  for (const card of options.existingCards ?? []) {
    const key = buildCardMatchKey(card, options.language);
    if (key && !existingMap.has(key)) {
      existingMap.set(key, card.id);
    }
  }

  const seenInPaste = new Set<string>();
  let valid = 0;
  let duplicates = 0;
  let inPasteDuplicates = 0;
  let inDeckDuplicates = 0;
  let errors = 0;
  let warnings = 0;

  const evaluated = rows.map((row) => {
    const issues: RowIssue[] = [];
    const effectiveTerm = row.term.trim() || (options.language === 'ja' ? row.kana.trim() : '');
    const effectiveMeaning = row.meaning.trim();

    if (!effectiveTerm) {
      issues.push({
        severity: 'error',
        code: 'empty_term',
        field: 'term',
        message: 'Term is required',
      });
    }
    if (!effectiveMeaning) {
      issues.push({
        severity: 'error',
        code: 'empty_meaning',
        field: 'meaning',
        message: 'Meaning is required',
      });
    }

    if (
      options.language === 'ja' &&
      (row.kanji.trim().length > 0 || containsKanji(row.term)) &&
      !row.kana.trim()
    ) {
      issues.push({
        severity: 'warning',
        code: 'missing_kana_for_kanji',
        field: 'kana',
        message: 'Kana reading missing for kanji term',
      });
    }

    if (
      row.term.length > MAX_FIELD_LENGTH ||
      row.meaning.length > MAX_FIELD_LENGTH ||
      row.kana.length > MAX_FIELD_LENGTH ||
      row.romaji.length > MAX_FIELD_LENGTH ||
      row.kanji.length > MAX_FIELD_LENGTH ||
      row.example.length > MAX_LONG_FIELD_LENGTH ||
      row.notes.length > MAX_LONG_FIELD_LENGTH
    ) {
      issues.push({
        severity: 'warning',
        code: 'field_too_long',
        message: 'Field exceeds recommended length',
      });
    }

    const matchKey = buildCardMatchKey({ term: effectiveTerm, kana: row.kana }, options.language);
    let isDuplicateInPaste = false;
    let isDuplicateInDeck = false;
    let existingCardId: string | undefined;

    if (matchKey) {
      if (seenInPaste.has(matchKey)) {
        isDuplicateInPaste = true;
        issues.push({
          severity: 'warning',
          code: 'duplicate_in_paste',
          field: 'term',
          message: 'Duplicate inside pasted text',
        });
      } else {
        seenInPaste.add(matchKey);
      }

      const existingId = existingMap.get(matchKey);
      if (existingId) {
        isDuplicateInDeck = true;
        existingCardId = existingId;
        issues.push({
          severity: 'warning',
          code: 'duplicate_in_deck',
          field: 'term',
          message: 'Already exists in target deck',
        });
      }
    }

    const hasError = issues.some((issue) => issue.severity === 'error');
    const hasWarning = issues.some((issue) => issue.severity === 'warning');

    if (hasError) errors++;
    else valid++;

    if (isDuplicateInPaste) inPasteDuplicates++;
    if (isDuplicateInDeck) inDeckDuplicates++;
    if (isDuplicateInPaste || isDuplicateInDeck) duplicates++;
    if (hasWarning) warnings++;

    return {
      ...row,
      term: effectiveTerm,
      issues,
      isDuplicateInPaste,
      isDuplicateInDeck,
      existingCardId,
      hasError,
    };
  });

  return {
    rows: evaluated,
    totals: {
      total: evaluated.length,
      valid,
      duplicates,
      inPasteDuplicates,
      inDeckDuplicates,
      errors,
      warnings,
    },
  };
}
