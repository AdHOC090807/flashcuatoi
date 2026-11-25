import { mapHeaderToImportField } from './detectFormat';
import { buildRowsFromTable, inferPositionalMapping } from './parseDelimited';
import { CHUNK_SIZE, extractDeckTitleAndBody, sanitizeCell, yieldToMain } from './normalize';
import type { ImportField, ParsedCardRow } from './types';

export interface ParseMarkdownOutput {
  rows: ParsedCardRow[];
  headers: string[];
  columnMapping: ImportField[];
  suggestedDeckName?: string;
}

const DIVIDER_CELL_RE = /^:?-{2,}:?$/;

function splitMarkdownRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(sanitizeCell(current));
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(sanitizeCell(current));
  return cells;
}

function isDividerRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => DIVIDER_CELL_RE.test(c.trim()));
}

/**
 * Parse Markdown table rows (`| col1 | col2 |`), skipping divider lines (`| --- | --- |`).
 */
export async function parseMarkdown(
  rawText: string,
  options?: {
    columnMappingOverride?: ImportField[];
    onProgress?: (progress: number) => void;
  }
): Promise<ParseMarkdownOutput> {
  const { suggestedDeckName, bodyText } = extractDeckTitleAndBody(rawText);
  const lines = bodyText.split('\n');
  const parsedTableRows: Array<{ cells: string[]; lineNumber: number; isDivider: boolean }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || !trimmed.includes('|')) continue;
    const cells = splitMarkdownRow(trimmed);
    parsedTableRows.push({
      cells,
      lineNumber: i + 1,
      isDivider: isDividerRow(cells),
    });
  }

  const dividerIdx = parsedTableRows.findIndex((r) => r.isDivider);
  const nonDividerRows = parsedTableRows.filter((r) => !r.isDivider);
  if (nonDividerRows.length === 0) {
    return { rows: [], headers: [], columnMapping: [], suggestedDeckName };
  }

  const firstRow = nonDividerRows[0].cells;
  const recognizedHeaders = firstRow.filter((h) => mapHeaderToImportField(h) !== 'ignore').length;
  const hasHeader = dividerIdx === 1 || recognizedHeaders >= 2;

  const maxCols = nonDividerRows.reduce((max, r) => Math.max(max, r.cells.length), firstRow.length);
  const headers = hasHeader
    ? Array.from({ length: maxCols }, (_, i) => firstRow[i] || `Column ${i + 1}`)
    : Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);

  const dataRows = (hasHeader ? nonDividerRows.slice(1) : nonDividerRows).map((r) => r.cells);
  const startLine = hasHeader ? (nonDividerRows[1]?.lineNumber ?? 2) : nonDividerRows[0].lineNumber;

  const defaultMapping = hasHeader
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
  return { rows, headers, columnMapping, suggestedDeckName };
}
