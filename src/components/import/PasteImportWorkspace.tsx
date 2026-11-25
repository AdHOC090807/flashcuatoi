import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  FileUp,
  History,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { db } from '@/db';
import { suggestCardFieldsWithAI } from '@/features/ai';
import { kanaToRomaji } from '@/features/japanese';
import {
  MAX_PASTE_BYTES,
  PASTE_EXAMPLES,
  enrichJapaneseRows,
  formatDefaultDeckName,
  parsePastedContent,
  saveImportedDeckOrCards,
  swapAllRows,
  swapSingleRow,
  undoImport,
  validateAndDedupeRows,
  type DetectedFormat,
  type ImportField,
  type LineSeparator,
  type ParsedCardRow,
  type PasteDuplicateStrategy,
  type PasteFormat,
  type PasteParseResult,
} from '@/lib/import';
import { usePasteDraftStore } from '@/store/usePasteDraftStore';
import { useToastStore } from '@/store/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { DeckLanguage } from '@/types';
import { PreviewTable } from './PreviewTable';

const DECK_EMOJIS = ['📘', '🇯🇵', '📚', '🗣️', '🌍', '💡', '💼', '✍️', '🧠', '🎯'];
const DECK_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const SEPARATOR_OPTIONS: Array<{ value: LineSeparator | 'auto'; labelKey: string }> = [
  { value: 'auto', labelKey: 'pasteImport.sepAuto' },
  { value: '\t', labelKey: 'pasteImport.sepTab' },
  { value: ' - ', labelKey: 'pasteImport.sepDash' },
  { value: ' = ', labelKey: 'pasteImport.sepEquals' },
  { value: ';', labelKey: 'pasteImport.sepSemicolon' },
  { value: '|', labelKey: 'pasteImport.sepPipe' },
  { value: ',', labelKey: 'pasteImport.sepComma' },
  { value: ':', labelKey: 'pasteImport.sepColon' },
];

interface PasteImportWorkspaceProps {
  defaultDeckId?: string;
  onRequestClose?: () => void;
  onImportSuccess?: (deckId: string) => void;
}

export function PasteImportWorkspace({
  defaultDeckId,
  onRequestClose,
  onImportSuccess,
}: PasteImportWorkspaceProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const decksQuery = useLiveQuery(() => db.decks.toArray());
  const decks = useMemo(() => decksQuery ?? [], [decksQuery]);
  const settings = useLiveQuery(() => db.settings.get('default'));
  const importHistoryQuery = useLiveQuery(() =>
    db.importHistory.orderBy('createdAt').reverse().limit(10).toArray()
  );
  const importHistory = useMemo(() => importHistoryQuery ?? [], [importHistoryQuery]);

  const draft = usePasteDraftStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'issues'>('all');
  const [columnMappingOverride, setColumnMappingOverride] = useState<ImportField[] | undefined>(
    undefined
  );

  const [parseResult, setParseResult] = useState<PasteParseResult | null>(null);
  const [editableRows, setEditableRows] = useState<ParsedCardRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Sync defaultDeckId when opened from a specific DeckDetailPage
  useEffect(() => {
    if (defaultDeckId) {
      draft.setDraft({ targetMode: 'existing', targetDeckId: defaultDeckId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDeckId]);

  const activeDeck = useMemo(
    () => decks.find((d) => d.id === draft.targetDeckId),
    [decks, draft.targetDeckId]
  );

  const effectiveLanguage: DeckLanguage = useMemo(() => {
    if (draft.targetMode === 'existing' && activeDeck) {
      return activeDeck.language || 'en';
    }
    return draft.languageOverride ?? parseResult?.detectedLanguage ?? 'en';
  }, [draft.targetMode, activeDeck, draft.languageOverride, parseResult?.detectedLanguage]);

  const existingCards = useLiveQuery(async () => {
    if (draft.targetMode !== 'existing' || !draft.targetDeckId) return [];
    return db.cards.where('deckId').equals(draft.targetDeckId).toArray();
  }, [draft.targetMode, draft.targetDeckId]);

  const batchLesson = useMemo(() => {
    const num = Number.parseInt(draft.batchLessonRaw.trim(), 10);
    return Number.isFinite(num) && num >= 1 && num <= 50 ? num : undefined;
  }, [draft.batchLessonRaw]);

  const batchTags = useMemo(
    () =>
      draft.batchTagsRaw
        .split(/[,;、]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [draft.batchTagsRaw]
  );

  // Reset manual column override whenever format or raw input changes structurally
  const handleTextChange = (nextText: string) => {
    setColumnMappingOverride(undefined);
    draft.setDraft({ rawText: nextText });
  };

  // Debounced parser pipeline (300ms)
  useEffect(() => {
    const trimmed = draft.rawText.trim();
    if (!trimmed) {
      setParseResult(null);
      setEditableRows([]);
      setParsing(false);
      setParseProgress(0);
      return;
    }

    let cancelled = false;
    setParsing(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await parsePastedContent(draft.rawText, {
            format: draft.format,
            separator: draft.separatorOverride,
            languageOverride:
              draft.targetMode === 'existing' && activeDeck
                ? activeDeck.language || 'en'
                : draft.languageOverride,
            columnMappingOverride,
            batchLesson,
            batchTags,
            existingCards: existingCards ?? [],
            onProgress: (p) => {
              if (!cancelled) setParseProgress(p);
            },
          });

          if (cancelled) return;

          setParseResult(result);
          setEditableRows(result.rows);
          setParseProgress(1);
          setParsing(false);

          if (!draft.deckNameTouched) {
            const suggested = result.suggestedDeckName || formatDefaultDeckName();
            if (draft.newDeckName !== suggested) {
              draft.setDraft({ newDeckName: suggested });
            }
          }

          if (!draft.languageOverride && draft.targetMode === 'new') {
            const targetEmoji = result.detectedLanguage === 'ja' ? '🇯🇵' : '📘';
            if (
              (draft.newDeckEmoji === '📘' && targetEmoji === '🇯🇵') ||
              (draft.newDeckEmoji === '🇯🇵' && targetEmoji === '📘')
            ) {
              draft.setDraft({ newDeckEmoji: targetEmoji });
            }
          }
        } catch (err) {
          if (cancelled) return;
          setParsing(false);
          setParseResult(null);
          setEditableRows([]);
          pushToast({
            title: t('pasteImport.parseErrorTitle'),
            description: err instanceof Error ? err.message : 'Unable to parse input',
            variant: 'error',
          });
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.rawText,
    draft.format,
    draft.separatorOverride,
    draft.languageOverride,
    draft.targetMode,
    activeDeck?.id,
    activeDeck?.language,
    columnMappingOverride,
    batchLesson,
    batchTags,
    existingCards,
  ]);

  // Re-validate immediately when user edits inline rows
  const recomputeValidation = useCallback(
    (nextRows: ParsedCardRow[]) => {
      const processed = effectiveLanguage === 'ja' ? enrichJapaneseRows(nextRows) : nextRows;
      const { rows: validated, totals } = validateAndDedupeRows(processed, {
        language: effectiveLanguage,
        existingCards: existingCards ?? [],
      });
      setEditableRows(validated);
      setParseResult((prev) => (prev ? { ...prev, rows: validated, totals } : prev));
    },
    [effectiveLanguage, existingCards]
  );

  const handleUpdateRow = useCallback(
    (rowId: string, patch: Partial<ParsedCardRow>) => {
      const next = editableRows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));
      recomputeValidation(next);
    },
    [editableRows, recomputeValidation]
  );

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      const next = editableRows.filter((row) => row.rowId !== rowId);
      recomputeValidation(next);
    },
    [editableRows, recomputeValidation]
  );

  const handleSwapRow = useCallback(
    (rowId: string) => {
      const next = editableRows.map((row) => (row.rowId === rowId ? swapSingleRow(row) : row));
      recomputeValidation(next);
    },
    [editableRows, recomputeValidation]
  );

  const handleSwapAll = useCallback(() => {
    const next = swapAllRows(editableRows);
    recomputeValidation(next);
  }, [editableRows, recomputeValidation]);

  const handleColumnMappingChange = (colIdx: number, field: ImportField) => {
    const base = [...(parseResult?.columnMapping ?? [])];
    base[colIdx] = field;
    setColumnMappingOverride(base);
  };

  const loadDroppedFile = async (file: File) => {
    if (file.size > MAX_PASTE_BYTES) {
      pushToast({
        title: t('pasteImport.fileTooLarge'),
        description: t('pasteImport.maxSizeNote'),
        variant: 'error',
      });
      return;
    }

    const lower = file.name.toLowerCase();
    if (!/\.(txt|csv|tsv|json|md)$/.test(lower)) {
      pushToast({
        title: t('pasteImport.unsupportedFile'),
        variant: 'warning',
      });
      return;
    }

    const text = await file.text();
    const byteSize = new TextEncoder().encode(text).length;
    if (byteSize > MAX_PASTE_BYTES) {
      pushToast({
        title: t('pasteImport.fileTooLarge'),
        variant: 'error',
      });
      return;
    }

    setColumnMappingOverride(undefined);
    draft.setDraft({ rawText: text, format: 'auto' });
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Clipboard read API unavailable');
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText.trim()) {
        pushToast({ title: t('pasteImport.clipboardEmpty'), variant: 'warning' });
        return;
      }
      handleTextChange(clipText);
    } catch {
      pushToast({
        title: t('pasteImport.clipboardFallbackTitle'),
        description: t('pasteImport.clipboardFallbackDesc'),
        variant: 'warning',
      });
    }
  };

  const activeTemplateFormat: Exclude<DetectedFormat, 'tsv'> =
    parseResult?.detectedFormat === 'csv' ||
    parseResult?.detectedFormat === 'json' ||
    parseResult?.detectedFormat === 'anki' ||
    parseResult?.detectedFormat === 'markdown'
      ? parseResult.detectedFormat
      : draft.format === 'csv' ||
          draft.format === 'json' ||
          draft.format === 'anki' ||
          draft.format === 'markdown'
        ? draft.format
        : 'lines';

  const handleCopyTemplate = async () => {
    const sample = PASTE_EXAMPLES[activeTemplateFormat];
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard write unavailable');
      }
      await navigator.clipboard.writeText(sample);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 1800);
      pushToast({ title: t('pasteImport.templateCopied'), variant: 'success' });
    } catch {
      handleTextChange(sample);
      pushToast({ title: t('pasteImport.templateInserted'), variant: 'default' });
    }
  };

  const aiConfigured = Boolean(settings?.aiEnabled && settings?.aiApiKey?.trim());

  const handleAiAssist = async () => {
    if (!aiConfigured || !settings) return;
    setAiLoading(true);
    try {
      const updated = [...editableRows];
      let filledCount = 0;

      for (let i = 0; i < updated.length; i++) {
        const row = updated[i];
        const queryTerm = (row.kana || row.term).trim();
        if (!queryTerm) continue;

        let nextRow = { ...row };
        let touched = false;

        if (effectiveLanguage === 'ja' && nextRow.kana && !nextRow.romaji) {
          nextRow.romaji = kanaToRomaji(nextRow.kana);
          touched = true;
        }

        if (!nextRow.meaning.trim() || !nextRow.example.trim()) {
          const suggested = await suggestCardFieldsWithAI(queryTerm, settings);
          if (!nextRow.meaning.trim() && suggested.meaning) {
            nextRow.meaning = suggested.meaning;
            touched = true;
          }
          if (!nextRow.phonetic.trim() && suggested.phonetic) {
            nextRow.phonetic = suggested.phonetic;
            touched = true;
          }
          if (!nextRow.partOfSpeech.trim() && suggested.partOfSpeech) {
            nextRow.partOfSpeech = suggested.partOfSpeech;
            touched = true;
          }
          if (!nextRow.example.trim() && suggested.example) {
            nextRow.example = suggested.example;
            touched = true;
          }
          if (!nextRow.exampleTranslation.trim() && suggested.exampleTranslation) {
            nextRow.exampleTranslation = suggested.exampleTranslation;
            touched = true;
          }
        }

        if (touched) {
          nextRow = { ...nextRow, aiSuggested: true };
          updated[i] = nextRow;
          filledCount++;
        }
      }

      recomputeValidation(updated);
      pushToast({
        title: t('pasteImport.aiDoneTitle'),
        description: t('pasteImport.aiDoneDesc', { count: filledCount }),
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: t('pasteImport.aiErrorTitle'),
        description: err instanceof Error ? err.message : 'AI request failed',
        variant: 'warning',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleUndoHistory = async (historyId: string) => {
    const res = await undoImport(historyId);
    if (res.undone) {
      pushToast({
        title: t('pasteImport.undoSuccessTitle'),
        description: t('pasteImport.undoSuccessDesc', {
          deleted: res.deletedCards,
          restored: res.restoredCards,
        }),
        variant: 'success',
      });
    }
  };

  const handleSave = async () => {
    if (!parseResult || saving) return;

    const validRows = editableRows.filter((r) => !r.hasError);
    if (validRows.length === 0) return;
    if (draft.targetMode === 'existing' && !draft.targetDeckId) return;

    setSaving(true);
    setSaveProgress(0.05);

    try {
      const result = await saveImportedDeckOrCards({
        rows: editableRows,
        format: parseResult.detectedFormat,
        duplicateStrategy: draft.duplicateStrategy,
        target:
          draft.targetMode === 'new'
            ? {
                mode: 'new',
                name: draft.newDeckName.trim() || formatDefaultDeckName(),
                emoji: draft.newDeckEmoji,
                color: draft.newDeckColor,
                language: effectiveLanguage,
                tags: batchTags,
              }
            : {
                mode: 'existing',
                deckId: draft.targetDeckId,
              },
        onProgress: setSaveProgress,
      });

      const totalSaved = result.importedCount + result.updatedCount;
      pushToast({
        title: t('pasteImport.saveSuccessTitle', { count: totalSaved }),
        description: `${result.deck.name}${
          result.skippedCount > 0
            ? ` • ${result.skippedCount} ${t('pasteImport.skippedLabel')}`
            : ''
        }`,
        variant: 'success',
        durationMs: 30000,
        linkLabel: t('pasteImport.studyNow'),
        linkTo: `/study/${result.deck.id}`,
        actionLabel: t('pasteImport.undoImport'),
        onAction: () => handleUndoHistory(result.historyEntry.id),
      });

      draft.setDraft({
        rawText: '',
        newDeckName: '',
        deckNameTouched: false,
        languageOverride: undefined,
      });
      setParseResult(null);
      setEditableRows([]);
      onImportSuccess?.(result.deck.id);
      onRequestClose?.();
    } catch (err) {
      pushToast({
        title: t('pasteImport.saveErrorTitle'),
        description: err instanceof Error ? err.message : 'Transaction failed',
        variant: 'error',
      });
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  const totals = parseResult?.totals;
  const hasAiSuggestions = editableRows.some((r) => r.aiSuggested);
  const canSave =
    Boolean(totals && totals.valid > 0) &&
    !saving &&
    !parsing &&
    (draft.targetMode === 'new' || Boolean(draft.targetDeckId));

  return (
    <div className="space-y-5 min-w-0">
      {/* Top Toolbar: Examples, Clipboard, Template, Format Help */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('pasteImport.examplesLabel')}:
          </span>
          {(['lines', 'csv', 'json', 'anki'] as const).map((exKey) => (
            <Button
              key={exKey}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setColumnMappingOverride(undefined);
                draft.setDraft({ rawText: PASTE_EXAMPLES[exKey], format: 'auto' });
              }}
            >
              {t(`pasteImport.formats.${exKey}`)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={handlePasteFromClipboard}>
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>{t('pasteImport.pasteClipboard')}</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleCopyTemplate}>
            {copiedTemplate ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{t('pasteImport.copyTemplate')}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((prev) => !prev)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{t('pasteImport.formatHelp')}</span>
            {helpOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Help Panel */}
      {helpOpen && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs space-y-2">
          <p className="font-semibold text-foreground">{t('pasteImport.helpHeading')}</p>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>{t('pasteImport.helpLines')}</li>
            <li>{t('pasteImport.helpCsv')}</li>
            <li>{t('pasteImport.helpJson')}</li>
            <li>{t('pasteImport.helpAnki')}</li>
            <li>{t('pasteImport.helpMarkdown')}</li>
            <li>{t('pasteImport.helpJapanese')}</li>
          </ul>
        </div>
      )}

      {/* Textarea + Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void loadDroppedFile(file);
        }}
        className={`rounded-xl border transition ${
          dragging ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-border bg-card'
        } p-3 space-y-2`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="paste-import-textarea" className="text-sm font-medium">
            {t('pasteImport.inputLabel')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {parseResult && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                {t('pasteImport.detectedBadge', {
                  format: t(`pasteImport.formats.${parseResult.detectedFormat}`),
                  lang: effectiveLanguage.toUpperCase(),
                })}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.tsv,.json,.md"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadDroppedFile(f);
                e.currentTarget.value = '';
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" />
              <span>{t('pasteImport.uploadFile')}</span>
            </Button>
            {draft.rawText && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setColumnMappingOverride(undefined);
                  draft.resetDraft();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('pasteImport.clearInput')}</span>
              </Button>
            )}
          </div>
        </div>

        <Textarea
          id="paste-import-textarea"
          rows={7}
          value={draft.rawText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={t('pasteImport.placeholder')}
          className="min-h-[140px] w-full font-mono text-xs sm:text-sm"
        />

        <p className="text-[11px] text-muted-foreground">{t('pasteImport.dropHint')}</p>
      </div>

      {/* Format, Separator, Language, Lesson & Tags Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="paste-format-select" className="mb-1 block text-xs font-medium">
            {t('pasteImport.formatLabel')}
          </label>
          <select
            id="paste-format-select"
            value={draft.format}
            onChange={(e) => {
              setColumnMappingOverride(undefined);
              draft.setDraft({ format: e.target.value as PasteFormat });
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="auto">{t('pasteImport.formats.auto')}</option>
            <option value="lines">{t('pasteImport.formats.lines')}</option>
            <option value="csv">{t('pasteImport.formats.csv')}</option>
            <option value="tsv">{t('pasteImport.formats.tsv')}</option>
            <option value="json">{t('pasteImport.formats.json')}</option>
            <option value="anki">{t('pasteImport.formats.anki')}</option>
            <option value="markdown">{t('pasteImport.formats.markdown')}</option>
          </select>
        </div>

        {(draft.format === 'lines' ||
          (draft.format === 'auto' &&
            (!parseResult || parseResult.detectedFormat === 'lines'))) && (
          <div>
            <label htmlFor="paste-separator-select" className="mb-1 block text-xs font-medium">
              {t('pasteImport.separatorLabel')}
            </label>
            <select
              id="paste-separator-select"
              value={draft.separatorOverride ?? 'auto'}
              onChange={(e) =>
                draft.setDraft({
                  separatorOverride:
                    e.target.value === 'auto' ? undefined : (e.target.value as LineSeparator),
                })
              }
              className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              {SEPARATOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="paste-lesson-input" className="mb-1 block text-xs font-medium">
            {t('pasteImport.batchLesson')}
          </label>
          <Input
            id="paste-lesson-input"
            type="number"
            min={1}
            max={50}
            value={draft.batchLessonRaw}
            onChange={(e) => draft.setDraft({ batchLessonRaw: e.target.value })}
            placeholder={t('pasteImport.batchLessonPlaceholder')}
            className="h-9"
          />
        </div>

        <div>
          <label htmlFor="paste-tags-input" className="mb-1 block text-xs font-medium">
            {t('pasteImport.batchTags')}
          </label>
          <Input
            id="paste-tags-input"
            value={draft.batchTagsRaw}
            onChange={(e) => draft.setDraft({ batchTagsRaw: e.target.value })}
            placeholder="minna, core, n5"
            className="h-9"
          />
        </div>
      </div>

      {/* Parse Progress */}
      {(parsing || saving) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {saving ? t('pasteImport.savingProgress') : t('pasteImport.parsingProgress')}
            </span>
            <span>{Math.round((saving ? saveProgress : parseProgress) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((saving ? saveProgress : parseProgress) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Parse / Zod Errors */}
      {parseResult && parseResult.parseErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t('pasteImport.parseErrorTitle')}</span>
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            {parseResult.parseErrors.slice(0, 10).map((err, idx) => (
              <li key={idx}>
                {err.line ? `Line ${err.line}: ` : ''}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Totals Status Bar & Optional AI Fill */}
      {totals && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <div aria-live="polite" className="text-xs font-medium text-foreground">
            {t('pasteImport.totalsSummary', {
              valid: totals.valid,
              duplicates: totals.duplicates,
              errors: totals.errors,
            })}
            {totals.errors > 0 && (
              <span className="ml-2 text-destructive">({t('pasteImport.errorsExcludedNote')})</span>
            )}
          </div>

          {aiConfigured && editableRows.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAiAssist}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{t('pasteImport.aiFillMissing')}</span>
            </Button>
          )}
        </div>
      )}

      {hasAiSuggestions && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200">
          {t('pasteImport.aiReviewNotice')}
        </div>
      )}

      {/* Live Preview Table */}
      {editableRows.length > 0 && (
        <PreviewTable
          rows={editableRows}
          language={effectiveLanguage}
          hasColumns={Boolean(parseResult?.hasColumns)}
          headers={parseResult?.headers ?? []}
          columnMapping={parseResult?.columnMapping ?? []}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          onColumnMappingChange={handleColumnMappingChange}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
          onSwapRow={handleSwapRow}
          onSwapAll={handleSwapAll}
        />
      )}

      {/* Save Destination & Duplicate Options */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="radio"
              name="paste-target-mode"
              checked={draft.targetMode === 'new'}
              onChange={() => draft.setDraft({ targetMode: 'new' })}
              className="accent-primary"
            />
            <span>{t('pasteImport.createNewDeck')}</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="radio"
              name="paste-target-mode"
              checked={draft.targetMode === 'existing'}
              onChange={() => {
                draft.setDraft({
                  targetMode: 'existing',
                  targetDeckId: draft.targetDeckId || decks[0]?.id || '',
                });
              }}
              className="accent-primary"
            />
            <span>{t('pasteImport.addToExistingDeck')}</span>
          </label>
        </div>

        {draft.targetMode === 'new' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label htmlFor="paste-deck-name" className="mb-1 block text-xs font-medium">
                {t('decks.name')}
              </label>
              <Input
                id="paste-deck-name"
                value={draft.newDeckName}
                onChange={(e) =>
                  draft.setDraft({ newDeckName: e.target.value, deckNameTouched: true })
                }
                placeholder={formatDefaultDeckName()}
                className="h-9"
              />
            </div>

            <div>
              <label htmlFor="paste-deck-lang" className="mb-1 block text-xs font-medium">
                {t('decks.language')}
              </label>
              <select
                id="paste-deck-lang"
                value={effectiveLanguage}
                onChange={(e) =>
                  draft.setDraft({ languageOverride: e.target.value as DeckLanguage })
                }
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="en">{t('decks.langEn')}</option>
                <option value="ja">{t('decks.langJa')}</option>
              </select>
            </div>

            <div>
              <label htmlFor="paste-dup-strategy" className="mb-1 block text-xs font-medium">
                {t('importExport.duplicates')}
              </label>
              <select
                id="paste-dup-strategy"
                value={draft.duplicateStrategy}
                onChange={(e) =>
                  draft.setDraft({
                    duplicateStrategy: e.target.value as PasteDuplicateStrategy,
                  })
                }
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="skip">{t('importExport.dupSkip')}</option>
                <option value="overwrite">{t('pasteImport.dupOverwrite')}</option>
                <option value="keep">{t('importExport.dupKeep')}</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {DECK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Emoji ${emoji}`}
                    onClick={() => draft.setDraft({ newDeckEmoji: emoji })}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                      draft.newDeckEmoji === emoji
                        ? 'border-primary bg-primary/15 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DECK_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    onClick={() => draft.setDraft({ newDeckColor: swatch })}
                    className={`h-6 w-6 rounded-full transition ${
                      draft.newDeckColor === swatch ? 'ring-2 ring-ring ring-offset-2' : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="paste-existing-deck" className="mb-1 block text-xs font-medium">
                {t('importExport.targetDeck')}
              </label>
              <select
                id="paste-existing-deck"
                value={draft.targetDeckId}
                onChange={(e) => draft.setDraft({ targetDeckId: e.target.value })}
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                {decks.length === 0 && <option value="">{t('pasteImport.noExistingDecks')}</option>}
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name} ({(d.language || 'en').toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="paste-dup-strategy-existing"
                className="mb-1 block text-xs font-medium"
              >
                {t('importExport.duplicates')}
              </label>
              <select
                id="paste-dup-strategy-existing"
                value={draft.duplicateStrategy}
                onChange={(e) =>
                  draft.setDraft({
                    duplicateStrategy: e.target.value as PasteDuplicateStrategy,
                  })
                }
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="skip">{t('importExport.dupSkip')}</option>
                <option value="overwrite">{t('pasteImport.dupOverwrite')}</option>
                <option value="keep">{t('importExport.dupKeep')}</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((prev) => !prev)}
          >
            <History className="h-4 w-4" />
            <span>
              {t('pasteImport.historyTitle')} ({importHistory.length})
            </span>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {onRequestClose && (
              <Button type="button" variant="outline" onClick={onRequestClose}>
                {t('common.cancel')}
              </Button>
            )}
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{t('pasteImport.saveButton', { count: totals?.valid ?? 0 })}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Import History & Undo List */}
      {historyOpen && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-semibold">{t('pasteImport.historyTitle')}</p>
          {importHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('pasteImport.historyEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {importHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {entry.deckName} • +{entry.importedCount}{' '}
                      {entry.updatedCount > 0 ? `/ ~${entry.updatedCount}` : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()} • {entry.format.toUpperCase()}
                    </p>
                  </div>

                  {entry.undoneAt ? (
                    <span className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {t('pasteImport.undoneLabel')}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndoHistory(entry.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t('pasteImport.undoImport')}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
