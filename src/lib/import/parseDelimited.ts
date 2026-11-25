import Papa from 'papaparse';
import { mapHeaderToImportField, normalizeHeaderKey } from './detectFormat';
import {
  CHUNK_SIZE,
  containsJapanese,
  extractDeckTitleAndBody,
  isRomajiOnlyTerm,
  normalizeTags,
  normalizeWordTypeValue,
  parseLessonValue,
  sanitizeCell,
  yieldToMain,
} from './normalize';
import type { ImportField, ParsedCardRow, PasteParseError } from './types';
import type { VerbForms } from '@/types';

export interface ParseDelimitedOutput {
  rows: ParsedCardRow[];
  headers: string[];
  columnMapping: ImportField[];
  suggestedDeckName?: string;
  parseErrors: PasteParseError[];
}

export function buildRowsFromTable(
  dataRows: string[][],
  columnMapping: ImportField[],
  startRowIndex = 1
): ParsedCardRow[] {
  const out: ParsedCardRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const cells = dataRows[r];
    if (cells.every((c) => !sanitizeCell(c))) continue;

    const row: ParsedCardRow = {
      rowId: `row_${r + 1}`,
      rowIndex: startRowIndex + r,
      term: '',
      meaning: '',
      kana: '',
      romaji: '',
      kanji: '',
      phonetic: '',
      partOfSpeech: '',
      example: '',
      exampleTranslation: '',
      notes: '',
      tags: [],
      rawColumns: cells.map((c) => sanitizeCell(c)),
      issues: [],
      isDuplicateInPaste: false,
      isDuplicateInDeck: false,
      hasError: false,
    };

    const verbForms: Partial<VerbForms> = {};
    let hasVerbForms = false;

    cells.forEach((rawCell, colIdx) => {
      const field = columnMapping[colIdx] ?? 'ignore';
      if (field === 'ignore') return;
      const val = sanitizeCell(rawCell);
      if (!val) return;

      switch (field) {
        case 'term':
          row.term = row.term ? `${row.term}; ${val}` : val;
          break;
        case 'meaning':
          row.meaning = row.meaning ? `${row.meaning}; ${val}` : val;
          break;
        case 'kana':
          row.kana = val;
          if (!row.term) row.term = val;
          break;
        case 'romaji':
          row.romaji = val;
          break;
        case 'kanji':
          row.kanji = val;
          break;
        case 'phonetic':
          row.phonetic = val;
          break;
        case 'partOfSpeech':
          row.partOfSpeech = val;
          break;
        case 'wordType':
          row.wordType = normalizeWordTypeValue(val);
          if (!row.partOfSpeech) row.partOfSpeech = val;
          break;
        case 'lesson':
          row.lesson = parseLessonValue(val);
          break;
        case 'example':
          row.example = val;
          break;
        case 'exampleTranslation':
          row.exampleTranslation = val;
          break;
        case 'notes':
          row.notes = val;
          break;
        case 'tags':
          row.tags = normalizeTags([...row.tags, val]);
          break;
        case 'masu':
          verbForms.masu = val;
          hasVerbForms = true;
          break;
        case 'te':
          verbForms.te = val;
          hasVerbForms = true;
          break;
        case 'ta':
          verbForms.ta = val;
          hasVerbForms = true;
          break;
        case 'nai':
          verbForms.nai = val;
          hasVerbForms = true;
          break;
      }
    });

    if (hasVerbForms) {
      row.verbForms = verbForms;
    }

    out.push(row);
  }

  return out;
}

export function inferPositionalMapping(sampleRows: string[][]): ImportField[] {
  const maxCols = sampleRows.reduce((max, row) => Math.max(max, row.length), 0);
  const slice = sampleRows.slice(0, 10);
  const firstColHasJa = slice.some((r) => containsJapanese(sanitizeCell(r[0] ?? '')));
  const col2Samples = slice.map((r) => sanitizeCell(r[2] ?? '')).filter(Boolean);
  const col2LooksRomaji =
    firstColHasJa && col2Samples.length > 0 && col2Samples.every((val) => isRomajiOnlyTerm(val));

  const mapping: ImportField[] = [];

  for (let i = 0; i < maxCols; i++) {
    if (i === 0) {
      mapping.push(firstColHasJa ? 'kana' : 'term');
    } else if (i === 1) {
      mapping.push('meaning');
    } else if (i === 2) {
      mapping.push(col2LooksRomaji ? 'romaji' : 'example');
    } else if (i === 3) {
      mapping.push(firstColHasJa && col2LooksRomaji ? 'kanji' : 'tags');
    } else {
      mapping.push('ignore');
    }
  }

  return mapping;
}

function hasAnyRecognizedHeader(headers: string[]): boolean {
  let recognized = 0;
  for (const h of headers) {
    if (mapHeaderToImportField(h) !== 'ignore') recognized++;
  }
  return recognized >= 2 || (headers.length === 2 && recognized >= 1);
}

/**
 * Parse CSV or TSV text using papaparse (supporting quoted fields, escaped quotes, and multi-line cells).
 */
export async function parseDelimited(
  rawText: string,
  options?: {
    delimiter?: ',' | '\t';
    columnMappingOverride?: ImportField[];
    onProgress?: (progress: number) => void;
  }
): Promise<ParseDelimitedOutput> {
  const { suggestedDeckName, bodyText } = extractDeckTitleAndBody(rawText);
  const trimmedBody = bodyText.trim();
  if (!trimmedBody) {
    return {
      rows: [],
      headers: [],
      columnMapping: [],
      suggestedDeckName,
      parseErrors: [],
    };
  }

  const parsed = Papa.parse<string[]>(trimmedBody, {
    delimiter: options?.delimiter,
    skipEmptyLines: 'greedy',
  });

  const parseErrors: PasteParseError[] = parsed.errors.map((err) => ({
    line: typeof err.row === 'number' ? err.row + 1 : undefined,
    message: err.message,
  }));

  const rawRecords = parsed.data.filter((cells) => cells.some((c) => sanitizeCell(c).length > 0));
  if (rawRecords.length === 0) {
    return {
      rows: [],
      headers: [],
      columnMapping: [],
      suggestedDeckName,
      parseErrors,
    };
  }

  const firstRowClean = rawRecords[0].map((c) => sanitizeCell(c));
  const treatFirstAsHeader =
    hasAnyRecognizedHeader(firstRowClean) ||
    firstRowClean.some((h) => normalizeHeaderKey(h) === 'word' || normalizeHeaderKey(h) === 'term');

  const maxCols = rawRecords.reduce((max, row) => Math.max(max, row.length), firstRowClean.length);
  const headers = treatFirstAsHeader
    ? Array.from({ length: maxCols }, (_, i) => firstRowClean[i] || `Column ${i + 1}`)
    : Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);

  const dataRows = treatFirstAsHeader ? rawRecords.slice(1) : rawRecords;
  const startLine = treatFirstAsHeader ? 2 : 1;

  const defaultMapping = treatFirstAsHeader
    ? headers.map((h) => mapHeaderToImportField(h))
    : inferPositionalMapping(dataRows);

  const columnMapping =
    options?.columnMappingOverride && options.columnMappingOverride.length >= maxCols
      ? options.columnMappingOverride.slice(0, maxCols)
      : defaultMapping;

  const rows: ParsedCardRow[] = [];
  for (let offset = 0; offset < dataRows.length; offset += CHUNK_SIZE) {
    const slice = dataRows.slice(offset, offset + CHUNK_SIZE);
    const built = buildRowsFromTable(slice, columnMapping, startLine + offset);
    for (let j = 0; j < built.length; j++) {
      built[j].rowId = `row_${rows.length + 1}`;
      rows.push(built[j]);
    }
    if (offset + CHUNK_SIZE < dataRows.length) {
      options?.onProgress?.(Math.min(0.95, (offset + CHUNK_SIZE) / Math.max(1, dataRows.length)));
      await yieldToMain();
    }
  }

  options?.onProgress?.(1);
  return {
    rows,
    headers,
    columnMapping,
    suggestedDeckName,
    parseErrors,
  };
}
