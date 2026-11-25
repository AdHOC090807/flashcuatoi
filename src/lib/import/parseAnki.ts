import Papa from 'papaparse';
import { mapHeaderToImportField } from './detectFormat';
import { buildRowsFromTable, inferPositionalMapping } from './parseDelimited';
import { CHUNK_SIZE, normalizeUnicodeAndSpaces, sanitizeCell, yieldToMain } from './normalize';
import type { ImportField, ParsedCardRow, PasteParseError } from './types';

export interface ParseAnkiOutput {
  rows: ParsedCardRow[];
  headers: string[];
  columnMapping: ImportField[];
  suggestedDeckName?: string;
  parseErrors: PasteParseError[];
}

function resolveAnkiSeparator(rawValue: string): string {
  const v = rawValue.trim().toLowerCase();
  if (v === 'tab' || v === '\\t') return '\t';
  if (v === 'comma' || v === ',') return ',';
  if (v === 'semicolon' || v === ';') return ';';
  if (v === 'pipe' || v === '|') return '|';
  if (v === 'colon' || v === ':') return ':';
  if (v === 'space') return ' ';
  return rawValue.trim() || '\t';
}

/**
 * Parse Anki "Notes in plain text" exports, supporting `#separator:`, `#columns:`, `#deck:`, and HTML cleanup.
 */
export async function parseAnki(
  rawText: string,
  options?: {
    columnMappingOverride?: ImportField[];
    onProgress?: (progress: number) => void;
  }
): Promise<ParseAnkiOutput> {
  const normalized = normalizeUnicodeAndSpaces(rawText);
  const lines = normalized.split('\n');

  let delimiter = '\t';
  let headerNames: string[] | null = null;
  let suggestedDeckName: string | undefined;
  const contentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sepMatch = trimmed.match(/^#separator:(.+)$/i);
    if (sepMatch) {
      delimiter = resolveAnkiSeparator(sepMatch[1]);
      continue;
    }

    const deckMatch = trimmed.match(/^#deck:(.+)$/i);
    if (deckMatch) {
      const candidate = sanitizeCell(deckMatch[1]);
      if (candidate) suggestedDeckName = candidate;
      continue;
    }

    const colMatch = trimmed.match(/^#columns:(.+)$/i);
    if (colMatch) {
      headerNames = colMatch[1]
        .split(/\t|[,;]/)
        .map((c) => sanitizeCell(c))
        .filter(Boolean);
      continue;
    }

    if (trimmed.startsWith('#')) {
      // Skip other Anki directive lines like #html:true, #notetype:Basic, #guid column:1
      continue;
    }

    contentLines.push(line);
  }

  const body = contentLines.join('\n').trim();
  if (!body) {
    return {
      rows: [],
      headers: headerNames ?? [],
      columnMapping: [],
      suggestedDeckName,
      parseErrors: [],
    };
  }

  const parsed = Papa.parse<string[]>(body, {
    delimiter,
    skipEmptyLines: 'greedy',
  });

  const parseErrors: PasteParseError[] = parsed.errors.map((err) => ({
    line: typeof err.row === 'number' ? err.row + 1 : undefined,
    message: err.message,
  }));

  const dataRows = parsed.data.filter((cells) => cells.some((c) => sanitizeCell(c).length > 0));
  const maxCols = dataRows.reduce((max, r) => Math.max(max, r.length), headerNames?.length ?? 0);

  const headers = Array.from({ length: maxCols }, (_, i) => headerNames?.[i] || `Field ${i + 1}`);

  const defaultMapping: ImportField[] = headerNames
    ? headers.map((h, i) => {
        const mapped = mapHeaderToImportField(h);
        if (mapped !== 'ignore') return mapped;
        return i === 0 ? 'term' : i === 1 ? 'meaning' : 'ignore';
      })
    : inferPositionalMapping(dataRows);

  const columnMapping =
    options?.columnMappingOverride && options.columnMappingOverride.length >= maxCols
      ? options.columnMappingOverride.slice(0, maxCols)
      : defaultMapping;

  const rows: ParsedCardRow[] = [];
  for (let offset = 0; offset < dataRows.length; offset += CHUNK_SIZE) {
    const slice = dataRows.slice(offset, offset + CHUNK_SIZE);
    const built = buildRowsFromTable(slice, columnMapping, offset + 1);
    for (const item of built) {
      item.rowId = `row_${rows.length + 1}`;
      rows.push(item);
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
