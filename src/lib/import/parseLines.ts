import { detectLineSeparator, splitOnFirstSeparator } from './detectFormat';
import { CHUNK_SIZE, extractDeckTitleAndBody, sanitizeCell, yieldToMain } from './normalize';
import type { LineSeparator, ParsedCardRow } from './types';

export interface ParseLinesOutput {
  rows: ParsedCardRow[];
  detectedSeparator: LineSeparator;
  suggestedDeckName?: string;
}

/**
 * Parse simple single-line entries (`term <sep> meaning`).
 * Always splits only on the FIRST occurrence of the detected (or user-selected) separator.
 */
export async function parseLines(
  rawText: string,
  options?: { separator?: LineSeparator; onProgress?: (progress: number) => void }
): Promise<ParseLinesOutput> {
  const { suggestedDeckName, bodyText } = extractDeckTitleAndBody(rawText);
  const rawLines = bodyText.split('\n');
  const nonEmptyLines: Array<{ lineNumber: number; text: string }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) continue;
    nonEmptyLines.push({ lineNumber: i + 1, text: trimmed });
  }

  const separator =
    options?.separator ?? detectLineSeparator(nonEmptyLines.map((item) => item.text));

  const rows: ParsedCardRow[] = [];
  const total = nonEmptyLines.length;

  for (let i = 0; i < total; i++) {
    const { lineNumber, text } = nonEmptyLines[i];
    const parts = splitOnFirstSeparator(text, separator);

    const term = parts ? sanitizeCell(parts[0]) : sanitizeCell(text);
    const meaning = parts ? sanitizeCell(parts[1]) : '';

    rows.push({
      rowId: `row_${i + 1}`,
      rowIndex: lineNumber,
      term,
      meaning,
      kana: '',
      romaji: '',
      kanji: '',
      phonetic: '',
      partOfSpeech: '',
      example: '',
      exampleTranslation: '',
      notes: '',
      tags: [],
      issues: [],
      isDuplicateInPaste: false,
      isDuplicateInDeck: false,
      hasError: false,
    });

    if ((i + 1) % CHUNK_SIZE === 0) {
      options?.onProgress?.(Math.min(0.95, (i + 1) / Math.max(1, total)));
      await yieldToMain();
    }
  }

  options?.onProgress?.(1);
  return { rows, detectedSeparator: separator, suggestedDeckName };
}
