import * as wanakana from 'wanakana';
import { kanaToRomaji, toCanonicalHiragana } from '@/features/japanese';
import { containsKana, containsKanji, isRomajiOnlyTerm } from './normalize';
import type { ParsedCardRow } from './types';

/**
 * Enrich rows for Japanese decks (`language === 'ja'`):
 * - Romaji-only terms -> convert to hiragana kana & populate romaji
 * - Kana terms without romaji -> auto-generate romaji via wanakana
 * - Kanji in `term` -> keep in `kanji` (hidden by default in app), use kana as primary `term` when provided
 * - Warn (later in validateRows) if kanji is present and kana is missing
 */
export function enrichJapaneseRows(rows: ParsedCardRow[]): ParsedCardRow[] {
  return rows.map((row) => {
    const term = row.term.trim();
    let kana = row.kana.trim();
    let kanji = row.kanji.trim();
    let romaji = row.romaji.trim();
    let nextTerm = term;

    // Preserve explicit kanji if term itself contains kanji characters
    if (containsKanji(term)) {
      if (!kanji) {
        kanji = term;
      }
      if (kana) {
        nextTerm = kana;
      }
    } else if (containsKana(term) && !kana) {
      kana = term;
    } else if (term && isRomajiOnlyTerm(term)) {
      // Convert romaji-only input to hiragana when target deck is Japanese
      const converted = toCanonicalHiragana(term);
      if (converted && containsKana(converted)) {
        kana = kana || converted;
        nextTerm = kana;
        if (!romaji) {
          romaji = wanakana.toRomaji(kana);
        }
      }
    } else if (!term && kana) {
      nextTerm = kana;
    }

    if (kana && !romaji) {
      romaji = kanaToRomaji(kana);
    }

    if (
      nextTerm === row.term &&
      kana === row.kana &&
      kanji === row.kanji &&
      romaji === row.romaji
    ) {
      return row;
    }

    return {
      ...row,
      term: nextTerm,
      kana,
      kanji,
      romaji,
    };
  });
}
