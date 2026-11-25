import { detectFormat } from './detectFormat';
import { enrichJapaneseRows } from './japaneseEnrich';
import { MAX_PASTE_BYTES, normalizeUnicodeAndSpaces, suggestDeckLanguage } from './normalize';
import { parseAnki } from './parseAnki';
import { parseDelimited } from './parseDelimited';
import { parseJson } from './parseJson';
import { parseLines } from './parseLines';
import { parseMarkdown } from './parseMarkdown';
import type { DetectedFormat, ParseOptions, ParsedCardRow, PasteParseResult } from './types';
import { validateAndDedupeRows } from './validateAndDedupe';

export * from './types';
export {
  MAX_PASTE_BYTES,
  containsJapanese,
  containsKanji,
  containsKana,
  formatDefaultDeckName,
  normalizeDelimiterPunctuation,
  normalizeUnicodeAndSpaces,
  sanitizeCell,
  stripHtmlAndDecodeEntities,
  suggestDeckLanguage,
} from './normalize';
export { detectFormat, detectLineSeparator, splitOnFirstSeparator } from './detectFormat';
export { parseLines } from './parseLines';
export { parseDelimited } from './parseDelimited';
export { parseAnki } from './parseAnki';
export { parseMarkdown } from './parseMarkdown';
export { parseJson } from './parseJson';
export { enrichJapaneseRows } from './japaneseEnrich';
export { validateAndDedupeRows, buildCardMatchKey } from './validateAndDedupe';
export {
  saveImportedDeckOrCards,
  undoImport,
  getRecentImportHistory,
  type SaveImportInput,
  type SaveImportResult,
  type UndoImportResult,
} from './saveImport';

export const PASTE_EXAMPLES: Record<Exclude<DetectedFormat, 'tsv'>, string> = {
  lines: `# Minna Bài 28
たべます - ăn - dùng bữa
のみます - uống
おはよう - chào buổi sáng
benkyou - học tập`,
  csv: `term,meaning,kana,romaji,kanji,lesson,tags
"apple, red","táo đỏ, ""giòn""",,,,1,"fruit, food"
"resilient","kiên cường; hồi phục nhanh",,,,,"ielts"`,
  json: `{
  "name": "JLPT N5 Starter",
  "language": "ja",
  "cards": [
    {
      "kana": "みず",
      "kanji": "水",
      "meaning": "nước",
      "lesson": 1,
      "tags": ["noun", "daily"]
    },
    {
      "term": "taberu",
      "meaning": "ăn",
      "kanji": "食べる",
      "lesson": 6
    }
  ]
}`,
  anki: `#separator:tab
#html:true
たべます\tăn<br><i>dùng bữa</i>\t毎日パンを食べます。
おはよう\tchào buổi sáng &amp; chúc một ngày tốt lành\tおはようございます`,
  markdown: `| kana | kanji | meaning | lesson |
| --- | --- | --- | --- |
| がくせい | 学生 | học sinh | 1 |
| せんせい | 先生 | giáo viên | 1 |`,
};

export function swapSingleRow(row: ParsedCardRow): ParsedCardRow {
  return {
    ...row,
    term: row.meaning,
    meaning: row.term,
  };
}

export function swapAllRows(rows: ParsedCardRow[]): ParsedCardRow[] {
  return rows.map(swapSingleRow);
}

export function applyBatchFields(
  rows: ParsedCardRow[],
  options: { batchLesson?: number; batchTags?: string[] }
): ParsedCardRow[] {
  const { batchLesson, batchTags } = options;
  if (!batchLesson && (!batchTags || batchTags.length === 0)) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    lesson: row.lesson ?? batchLesson,
    tags:
      batchTags && batchTags.length > 0
        ? Array.from(new Set([...row.tags, ...batchTags]))
        : row.tags,
  }));
}

/**
 * Unified async parser pipeline:
 * 1. Detect or apply explicit format
 * 2. Parse chunked rows
 * 3. Apply batch lesson/tags & smart Japanese enrichment
 * 4. Validate and dedupe against target deck
 */
export async function parsePastedContent(
  rawText: string,
  options: ParseOptions = {}
): Promise<PasteParseResult> {
  const byteSize = new TextEncoder().encode(rawText).length;
  if (byteSize > MAX_PASTE_BYTES) {
    return {
      detectedFormat: 'lines',
      detectedLanguage: options.languageOverride ?? 'en',
      hasColumns: false,
      headers: [],
      columnMapping: [],
      rows: [],
      parseErrors: [
        {
          path: 'input',
          message: `Input exceeds maximum allowed size of ${Math.round(MAX_PASTE_BYTES / (1024 * 1024))} MB`,
        },
      ],
      totals: {
        total: 0,
        valid: 0,
        duplicates: 0,
        inPasteDuplicates: 0,
        inDeckDuplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };
  }

  const normalized = normalizeUnicodeAndSpaces(rawText);
  const detectedFormat: DetectedFormat =
    !options.format || options.format === 'auto' ? detectFormat(normalized) : options.format;

  let rows: ParsedCardRow[] = [];
  let headers: string[] = [];
  let columnMapping = options.columnMappingOverride ?? [];
  let hasColumns = false;
  let detectedSeparator = options.separator;
  let suggestedDeckName: string | undefined;
  let suggestedLanguage = undefined;
  let parseErrors: PasteParseResult['parseErrors'] = [];

  if (detectedFormat === 'json') {
    const res = await parseJson(normalized, { onProgress: options.onProgress });
    rows = res.rows;
    suggestedDeckName = res.suggestedDeckName;
    suggestedLanguage = res.suggestedLanguage;
    parseErrors = res.parseErrors;
  } else if (detectedFormat === 'anki') {
    const res = await parseAnki(normalized, {
      columnMappingOverride: options.columnMappingOverride,
      onProgress: options.onProgress,
    });
    rows = res.rows;
    headers = res.headers;
    columnMapping = res.columnMapping;
    hasColumns = headers.length >= 2;
    suggestedDeckName = res.suggestedDeckName;
    parseErrors = res.parseErrors;
  } else if (detectedFormat === 'csv' || detectedFormat === 'tsv') {
    const res = await parseDelimited(normalized, {
      delimiter: detectedFormat === 'tsv' ? '\t' : ',',
      columnMappingOverride: options.columnMappingOverride,
      onProgress: options.onProgress,
    });
    rows = res.rows;
    headers = res.headers;
    columnMapping = res.columnMapping;
    hasColumns = headers.length >= 2;
    suggestedDeckName = res.suggestedDeckName;
    parseErrors = res.parseErrors;
  } else if (detectedFormat === 'markdown') {
    const res = await parseMarkdown(normalized, {
      columnMappingOverride: options.columnMappingOverride,
      onProgress: options.onProgress,
    });
    rows = res.rows;
    headers = res.headers;
    columnMapping = res.columnMapping;
    hasColumns = headers.length >= 2;
    suggestedDeckName = res.suggestedDeckName;
  } else {
    const res = await parseLines(normalized, {
      separator: options.separator,
      onProgress: options.onProgress,
    });
    rows = res.rows;
    detectedSeparator = res.detectedSeparator;
    suggestedDeckName = res.suggestedDeckName;
  }

  const detectedLanguage =
    options.languageOverride ?? suggestedLanguage ?? suggestDeckLanguage(rows);

  const batched = applyBatchFields(rows, {
    batchLesson: options.batchLesson,
    batchTags: options.batchTags,
  });

  const enriched = detectedLanguage === 'ja' ? enrichJapaneseRows(batched) : batched;

  const { rows: validatedRows, totals } = validateAndDedupeRows(enriched, {
    language: detectedLanguage,
    existingCards: options.existingCards,
  });

  return {
    detectedFormat,
    detectedSeparator,
    detectedLanguage,
    suggestedDeckName,
    hasColumns,
    headers,
    columnMapping,
    rows: validatedRows,
    parseErrors,
    totals,
  };
}
