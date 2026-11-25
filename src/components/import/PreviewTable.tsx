import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, ArrowLeftRight, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ImportField, ParsedCardRow } from '@/lib/import';
import type { DeckLanguage } from '@/types';

const VIRTUAL_THRESHOLD = 200;
const ROW_HEIGHT = 76;
const VIEWPORT_HEIGHT = 440;

const MAPPABLE_FIELDS: ImportField[] = [
  'ignore',
  'term',
  'meaning',
  'kana',
  'romaji',
  'kanji',
  'phonetic',
  'partOfSpeech',
  'wordType',
  'lesson',
  'example',
  'exampleTranslation',
  'notes',
  'tags',
  'masu',
  'te',
  'ta',
  'nai',
];

interface PreviewTableProps {
  rows: ParsedCardRow[];
  language: DeckLanguage;
  hasColumns: boolean;
  headers: string[];
  columnMapping: ImportField[];
  filterMode: 'all' | 'issues';
  onFilterModeChange: (mode: 'all' | 'issues') => void;
  onColumnMappingChange: (colIdx: number, field: ImportField) => void;
  onUpdateRow: (rowId: string, patch: Partial<ParsedCardRow>) => void;
  onDeleteRow: (rowId: string) => void;
  onSwapRow: (rowId: string) => void;
  onSwapAll: () => void;
}

export function PreviewTable({
  rows,
  language,
  hasColumns,
  headers,
  columnMapping,
  filterMode,
  onFilterModeChange,
  onColumnMappingChange,
  onUpdateRow,
  onDeleteRow,
  onSwapRow,
  onSwapAll,
}: PreviewTableProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const showJapaneseColumns =
    language === 'ja' || rows.some((r) => Boolean(r.kana || r.romaji || r.kanji));

  const filteredRows = useMemo(() => {
    if (filterMode === 'issues') {
      return rows.filter((r) => r.issues.length > 0);
    }
    return rows;
  }, [rows, filterMode]);

  const isVirtualized = filteredRows.length > VIRTUAL_THRESHOLD;
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 8;
  const startIdx = isVirtualized ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4) : 0;
  const endIdx = isVirtualized
    ? Math.min(filteredRows.length, startIdx + visibleCount)
    : filteredRows.length;

  const visibleRows = filteredRows.slice(startIdx, endIdx);
  const topSpacerHeight = startIdx * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (filteredRows.length - endIdx) * ROW_HEIGHT);
  const colSpan = showJapaneseColumns ? 9 : 6;

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onFilterModeChange('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              filterMode === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background hover:bg-accent'
            }`}
          >
            {t('pasteImport.filterAll', { count: rows.length })}
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange('issues')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              filterMode === 'issues'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background hover:bg-accent'
            }`}
          >
            {t('pasteImport.filterIssues', {
              count: rows.filter((r) => r.issues.length > 0).length,
            })}
          </button>
          {isVirtualized && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
              {t('pasteImport.virtualizedRange', {
                from: startIdx + 1,
                to: endIdx,
                total: filteredRows.length,
              })}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onSwapAll}
          disabled={rows.length === 0}
          title={t('pasteImport.swapAll')}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>{t('pasteImport.swapAll')}</span>
        </Button>
      </div>

      {hasColumns && headers.length >= 2 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('pasteImport.columnMapping')}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {headers.map((header, idx) => (
              <div key={`${header}-${idx}`} className="min-w-0">
                <label
                  htmlFor={`col-map-${idx}`}
                  className="mb-1 block truncate text-[11px] font-medium text-muted-foreground"
                  title={header}
                >
                  {header}
                </label>
                <select
                  id={`col-map-${idx}`}
                  value={columnMapping[idx] ?? 'ignore'}
                  onChange={(e) => onColumnMappingChange(idx, e.target.value as ImportField)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  {MAPPABLE_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={(e) => {
          if (isVirtualized) {
            setScrollTop(e.currentTarget.scrollTop);
          }
        }}
        className="max-h-[440px] w-full overflow-auto rounded-xl border border-border bg-background"
      >
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur">
            <tr>
              <th className="w-12 px-2 py-2 font-semibold">#</th>
              <th className="min-w-[140px] px-2 py-2 font-semibold">{t('cards.term')}</th>
              <th className="min-w-[170px] px-2 py-2 font-semibold">{t('cards.meaning')}</th>
              {showJapaneseColumns && (
                <>
                  <th className="min-w-[125px] px-2 py-2 font-semibold">Kana</th>
                  <th className="min-w-[115px] px-2 py-2 font-semibold">Romaji</th>
                  <th className="min-w-[105px] px-2 py-2 font-semibold">Kanji</th>
                </>
              )}
              <th className="min-w-[150px] px-2 py-2 font-semibold">{t('cards.example')}</th>
              <th className="min-w-[140px] px-2 py-2 font-semibold">
                {t('pasteImport.statusCol')}
              </th>
              <th className="w-20 px-2 py-2 text-right font-semibold">
                {t('pasteImport.actionsCol')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isVirtualized && topSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: `${topSpacerHeight}px`, padding: 0 }} />
              </tr>
            )}

            {visibleRows.map((row) => (
              <tr
                key={row.rowId}
                style={isVirtualized ? { height: `${ROW_HEIGHT}px` } : undefined}
                className={
                  row.hasError
                    ? 'bg-destructive/5'
                    : row.issues.length > 0
                      ? 'bg-amber-500/5'
                      : 'hover:bg-accent/30'
                }
              >
                <td className="px-2 py-1.5 align-top font-mono text-[11px] text-muted-foreground">
                  {row.rowIndex}
                </td>

                <td className="px-2 py-1.5 align-top">
                  <input
                    type="text"
                    aria-label={`${t('cards.term')} row ${row.rowIndex}`}
                    value={row.term}
                    onChange={(e) => onUpdateRow(row.rowId, { term: e.target.value })}
                    className={`h-8 w-full rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring ${
                      row.issues.some((i) => i.code === 'empty_term')
                        ? 'border-destructive'
                        : 'border-input'
                    }`}
                  />
                </td>

                <td className="px-2 py-1.5 align-top">
                  <input
                    type="text"
                    aria-label={`${t('cards.meaning')} row ${row.rowIndex}`}
                    value={row.meaning}
                    onChange={(e) => onUpdateRow(row.rowId, { meaning: e.target.value })}
                    className={`h-8 w-full rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring ${
                      row.issues.some((i) => i.code === 'empty_meaning')
                        ? 'border-destructive'
                        : 'border-input'
                    }`}
                  />
                </td>

                {showJapaneseColumns && (
                  <>
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="text"
                        lang="ja"
                        aria-label={`Kana row ${row.rowIndex}`}
                        value={row.kana}
                        onChange={(e) => onUpdateRow(row.rowId, { kana: e.target.value })}
                        className="h-8 w-full rounded border border-input bg-background px-2 font-jp text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="text"
                        aria-label={`Romaji row ${row.rowIndex}`}
                        value={row.romaji}
                        onChange={(e) => onUpdateRow(row.rowId, { romaji: e.target.value })}
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <input
                        type="text"
                        lang="ja"
                        aria-label={`Kanji row ${row.rowIndex}`}
                        value={row.kanji}
                        onChange={(e) => onUpdateRow(row.rowId, { kanji: e.target.value })}
                        className="h-8 w-full rounded border border-input bg-background px-2 font-jp text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                  </>
                )}

                <td className="px-2 py-1.5 align-top">
                  <input
                    type="text"
                    aria-label={`${t('cards.example')} row ${row.rowIndex}`}
                    value={row.example}
                    onChange={(e) => onUpdateRow(row.rowId, { example: e.target.value })}
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>

                <td className="px-2 py-1.5 align-top">
                  <div className="flex flex-wrap gap-1">
                    {row.issues.map((issue, idx) => (
                      <span
                        key={`${issue.code}-${idx}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          issue.severity === 'error'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {issue.severity === 'error' ? (
                          <AlertCircle className="h-3 w-3 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                        )}
                        {t(`pasteImport.issue.${issue.code}`)}
                      </span>
                    ))}
                    {row.aiSuggested && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                        <Sparkles className="h-3 w-3" />
                        AI
                      </span>
                    )}
                    {row.issues.length === 0 && !row.aiSuggested && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        {t('pasteImport.statusOk')}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-2 py-1.5 align-top text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSwapRow(row.rowId)}
                      aria-label={t('pasteImport.swapRow', { row: row.rowIndex })}
                      title={t('pasteImport.swapRow', { row: row.rowIndex })}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRow(row.rowId)}
                      aria-label={t('pasteImport.deleteRow', { row: row.rowIndex })}
                      title={t('pasteImport.deleteRow', { row: row.rowIndex })}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {isVirtualized && bottomSpacerHeight > 0 && (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: `${bottomSpacerHeight}px`, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
