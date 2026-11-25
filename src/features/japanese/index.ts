import * as wanakana from 'wanakana';
import type { Card } from '@/types';

const VOWEL_ROW_A = new Set([
  'あ',
  'か',
  'さ',
  'た',
  'な',
  'は',
  'ま',
  'や',
  'ら',
  'わ',
  'が',
  'ざ',
  'だ',
  'ば',
  'ぱ',
  'ゃ',
]);
const VOWEL_ROW_I = new Set([
  'い',
  'き',
  'し',
  'ち',
  'に',
  'ひ',
  'み',
  'り',
  'ぎ',
  'じ',
  'ぢ',
  'び',
  'ぴ',
]);
const VOWEL_ROW_U = new Set([
  'う',
  'く',
  'す',
  'つ',
  'ぬ',
  'ふ',
  'む',
  'ゆ',
  'る',
  'ぐ',
  'ず',
  'づ',
  'ぶ',
  'ぷ',
  'ゅ',
]);
const VOWEL_ROW_E = new Set([
  'え',
  'け',
  'せ',
  'て',
  'ね',
  'へ',
  'め',
  'れ',
  'げ',
  'ぜ',
  'で',
  'べ',
  'ぺ',
]);
const VOWEL_ROW_O = new Set([
  'お',
  'こ',
  'そ',
  'と',
  'の',
  'ほ',
  'も',
  'よ',
  'ろ',
  'を',
  'ご',
  'ぞ',
  'ど',
  'ぼ',
  'ぽ',
  'ょ',
]);

/**
 * Convert kana (hiragana/katakana) to Hepburn romaji using wanakana.
 */
export function kanaToRomaji(kana: string): string {
  if (!kana.trim()) return '';
  return wanakana.toRomaji(kana.trim());
}

/**
 * Convert romaji/katakana input into hiragana, handling macrons and n'.
 */
export function toCanonicalHiragana(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[\s\-・。、.,!?'"「」『』()（）]/g, (ch) => (ch === "'" ? "'" : ''))
    // Normalize macron vowels to standard double vowels before wanakana conversion
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ū/g, 'uu')
    .replace(/ē/g, 'ee')
    .replace(/ō/g, 'ou')
    .replace(/â/g, 'aa')
    .replace(/î/g, 'ii')
    .replace(/û/g, 'uu')
    .replace(/ê/g, 'ee')
    .replace(/ô/g, 'ou');
  const parts = cleaned.split(/n'/g);
  return parts.map((part) => wanakana.toHiragana(part, { passRomaji: false })).join('ん');
}

/**
 * Normalize Japanese text for tolerant comparison:
 * - Accepts kana OR romaji
 * - Hiragana-Katakana equivalence
 * - Long-vowel equivalence (ou/oo/ō -> ー, ei/ee -> ー, aa/ii/uu -> ー)
 * - Preserves small tsu (っ) and syllabic ん
 */
export function normalizeJapaneseForComparison(input: string): string {
  const hira = toCanonicalHiragana(input);
  let out = '';

  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i];
    const prev = out[out.length - 1] ?? '';

    if (ch === 'ー') {
      if (prev !== 'ー') out += 'ー';
      continue;
    }

    if (
      (ch === 'あ' && VOWEL_ROW_A.has(prev)) ||
      (ch === 'い' && VOWEL_ROW_I.has(prev)) ||
      (ch === 'う' && (VOWEL_ROW_U.has(prev) || VOWEL_ROW_O.has(prev))) ||
      ((ch === 'え' || ch === 'い') && VOWEL_ROW_E.has(prev)) ||
      (ch === 'お' && VOWEL_ROW_O.has(prev))
    ) {
      out += 'ー';
      continue;
    }

    out += ch;
  }

  return out;
}

export function isJapaneseMatch(
  userInput: string,
  target: Pick<Card, 'term' | 'kana' | 'romaji' | 'kanji'> | string
): { isMatch: boolean; isExact: boolean } {
  const rawInput = userInput.trim();
  if (!rawInput) return { isMatch: false, isExact: false };

  const expectedList =
    typeof target === 'string'
      ? [target]
      : [target.kana, target.term, target.romaji, target.kanji].filter((v): v is string =>
          Boolean(v && v.trim())
        );

  for (const exp of expectedList) {
    if (rawInput.toLowerCase() === exp.trim().toLowerCase()) {
      return { isMatch: true, isExact: true };
    }
  }

  const normalizedInput = normalizeJapaneseForComparison(rawInput);
  if (!normalizedInput) return { isMatch: false, isExact: false };

  for (const exp of expectedList) {
    if (!exp || exp === (typeof target === 'string' ? '' : target.kanji)) continue;
    const normalizedExpected = normalizeJapaneseForComparison(exp);
    if (normalizedInput === normalizedExpected) {
      return { isMatch: true, isExact: false };
    }
  }

  return { isMatch: false, isExact: false };
}

export function getDisplayKana(card: Pick<Card, 'term' | 'kana'>): string {
  return (card.kana || card.term).trim();
}

/**
 * Select Japanese quiz distractors prioritizing same wordType and similar kana length.
 */
export function pickJapaneseQuizDistractors(target: Card, pool: Card[], count = 3): Card[] {
  const targetKana = getDisplayKana(target);
  const targetLen = targetKana.length;
  const targetWordType = target.wordType || target.partOfSpeech;

  const candidates = pool.filter(
    (c) =>
      c.id !== target.id &&
      c.meaning.trim() !== target.meaning.trim() &&
      getDisplayKana(c) !== targetKana
  );

  const scored = candidates
    .map((c) => {
      const sameType =
        targetWordType && (c.wordType || c.partOfSpeech) === targetWordType ? 100 : 0;
      const lenDiff = Math.abs(getDisplayKana(c).length - targetLen);
      const jitter = Math.random() * 6;
      return {
        card: c,
        score: sameType - lenDiff * 5 + jitter,
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((item) => item.card);
}
