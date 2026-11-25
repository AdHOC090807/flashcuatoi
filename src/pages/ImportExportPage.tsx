import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ClipboardPaste, Download, FileUp, Sparkles, UploadCloud } from 'lucide-react';
import { db } from '@/db';
import {
  buildJapanesePresetMapping,
  commitMappedImport,
  ensureTargetDeck,
  exportCardsToAnkiTSV,
  exportCardsToCSV,
  exportFullBackup,
  isFullBackupPayload,
  parseImportFile,
  restoreFullBackup,
  type MappableField,
  type ParsedImportTable,
} from '@/features/import-export';
import { useToastStore } from '@/store/useToastStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { DeckLanguage } from '@/types';

const MAPPABLE_FIELDS: MappableField[] = [
  'ignore',
  'term',
  'meaning',
  'phonetic',
  'partOfSpeech',
  'example',
  'exampleTranslation',
  'notes',
  'tags',
  'kana',
  'romaji',
  'kanji',
  'wordType',
  'lesson',
  'masu',
  'te',
  'ta',
  'nai',
];

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportPage() {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const decks = useLiveQuery(() => db.decks.toArray()) ?? [];
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<ParsedImportTable | null>(null);
  const [mapping, setMapping] = useState<MappableField[]>([]);
  const [targetDeckId, setTargetDeckId] = useState<string>('__new__');
  const [newDeckName, setNewDeckName] = useState('Imported Vocabulary');
  const [newDeckLanguage, setNewDeckLanguage] = useState<DeckLanguage>('en');
  const [dupStrategy, setDupStrategy] = useState<'skip' | 'update' | 'keep'>('skip');
  const [exportDeckId, setExportDeckId] = useState<string>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const jsonData = JSON.parse(text) as unknown;
        if (isFullBackupPayload(jsonData)) {
          const res = await restoreFullBackup(jsonData);
          pushToast({
            title: t('importExport.restoreBackup'),
            description: `${res.decksRestored} decks, ${res.cardsRestored} cards restored`,
            variant: 'success',
          });
          return;
        }
      }

      const table = parseImportFile(file.name, text);
      if (table.rows.length === 0) {
        pushToast({ title: 'No rows found in file', variant: 'warning' });
        return;
      }
      setParsed(table);
      setMapping(table.suggestedMapping);
      if (table.suggestedMapping.includes('kana')) {
        setNewDeckLanguage('ja');
      }
      if (decks[0]?.id && targetDeckId === '__new__') {
        setTargetDeckId(decks[0].id);
      }
    } catch (err) {
      pushToast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Invalid file format',
        variant: 'error',
      });
    }
  };

  const applyPreset = (preset: 'anki_ja_basic' | 'anki_ja_full') => {
    if (!parsed) return;
    setMapping(buildJapanesePresetMapping(parsed.headers.length, preset));
    setNewDeckLanguage('ja');
    const jaDeck = decks.find((d) => d.language === 'ja');
    if (jaDeck && targetDeckId === '__new__') {
      setTargetDeckId(jaDeck.id);
    }
  };

  const handleCommitImport = async () => {
    if (!parsed) return;
    const resolvedDeckId = await ensureTargetDeck(targetDeckId, newDeckName, newDeckLanguage);
    const res = await commitMappedImport(resolvedDeckId, parsed.rows, mapping, dupStrategy);
    pushToast({
      title: t('importExport.importNow'),
      description: `+${res.added} added, ${res.updated} updated, ${res.skipped} skipped`,
      variant: 'success',
    });
    setParsed(null);
  };

  const handleExport = async (format: 'csv' | 'tsv') => {
    const cardsToExport =
      exportDeckId === 'all'
        ? await db.cards.toArray()
        : await db.cards.where('deckId').equals(exportDeckId).toArray();

    if (format === 'csv') {
      downloadBlob(
        'lexicards-export.csv',
        exportCardsToCSV(cardsToExport),
        'text/csv;charset=utf-8'
      );
    } else {
      downloadBlob(
        'lexicards-anki.tsv',
        exportCardsToAnkiTSV(cardsToExport),
        'text/tab-separated-values;charset=utf-8'
      );
    }
    pushToast({
      title: t('common.export'),
      description: `${cardsToExport.length} ${t('common.cards')}`,
      variant: 'success',
    });
  };

  const handleFullBackupDownload = async () => {
    const payload = await exportFullBackup();
    downloadBlob(
      `lexicards-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    pushToast({ title: t('importExport.exportBackup'), variant: 'success' });
  };

  const handleBackupRestore = async (file: File) => {
    try {
      const text = await file.text();
      const parsedJson = JSON.parse(text) as unknown;
      if (!isFullBackupPayload(parsedJson)) {
        throw new Error('Invalid LexiCards backup JSON structure');
      }
      const res = await restoreFullBackup(parsedJson);
      pushToast({
        title: t('importExport.restoreBackup'),
        description: `${res.decksRestored} decks, ${res.cardsRestored} cards restored`,
        variant: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Invalid JSON',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('importExport.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('importExport.subtitle')}</p>
        </div>
        <Link to="/import/paste">
          <Button variant="outline">
            <ClipboardPaste className="h-4 w-4" />
            <span>{t('pasteImport.entryButton')}</span>
          </Button>
        </Link>
      </div>

      {/* Dropzone */}
      <Card>
        <CardContent className="p-6">
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
              if (file) void handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
            }`}
          >
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="mt-3 font-semibold">{t('importExport.dropTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('importExport.dropSubtitle')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview & Column Mapping */}
      {parsed && (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>
              {t('importExport.preview')} —{' '}
              {t('importExport.rowsFound', { count: parsed.rows.length })}
            </CardTitle>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyPreset('anki_ja_basic')}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t('japanese.presetBasic')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset('anki_ja_full')}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t('japanese.presetFull')}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t('importExport.targetDeck')}
                </label>
                <select
                  value={targetDeckId}
                  onChange={(e) => setTargetDeckId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="__new__">{t('importExport.createNewDeck')}</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.emoji} {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {targetDeckId === '__new__' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {t('importExport.newDeckName')}
                    </label>
                    <Input value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">{t('decks.language')}</label>
                    <select
                      value={newDeckLanguage}
                      onChange={(e) => setNewDeckLanguage(e.target.value as DeckLanguage)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="en">{t('decks.langEn')}</option>
                      <option value="ja">{t('decks.langJa')}</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium">
                  {t('importExport.duplicates')}
                </label>
                <select
                  value={dupStrategy}
                  onChange={(e) => setDupStrategy(e.target.value as 'skip' | 'update' | 'keep')}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="skip">{t('importExport.dupSkip')}</option>
                  <option value="update">{t('importExport.dupUpdate')}</option>
                  <option value="keep">{t('importExport.dupKeep')}</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    {parsed.headers.map((header, idx) => (
                      <th key={idx} className="p-2.5">
                        <div className="mb-1 font-semibold text-muted-foreground">{header}</div>
                        <select
                          aria-label={`Map column ${header}`}
                          value={mapping[idx] ?? 'ignore'}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[idx] = e.target.value as MappableField;
                            setMapping(next);
                          }}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          {MAPPABLE_FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="border-t border-border">
                      {parsed.headers.map((_, cIdx) => (
                        <td key={cIdx} className="max-w-[180px] truncate p-2.5">
                          {row[cIdx] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCommitImport}>{t('importExport.importNow')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export & Backup */}
      <Card>
        <CardHeader>
          <CardTitle>{t('importExport.exportSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 max-w-sm">
              <label htmlFor="export-deck" className="mb-1 block text-xs font-medium">
                {t('importExport.selectDeckExport')}
              </label>
              <select
                id="export-deck"
                value={exportDeckId}
                onChange={(e) => setExportDeckId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="all">{t('common.all')}</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleExport('csv')}>
                <Download className="h-4 w-4" />
                <span>{t('importExport.exportCsv')}</span>
              </Button>
              <Button variant="outline" onClick={() => void handleExport('tsv')}>
                <Download className="h-4 w-4" />
                <span>{t('importExport.exportTsv')}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button onClick={handleFullBackupDownload}>
              <Download className="h-4 w-4" />
              <span>{t('importExport.exportBackup')}</span>
            </Button>
            <Button variant="secondary" onClick={() => backupInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              <span>{t('importExport.restoreBackup')}</span>
            </Button>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleBackupRestore(f);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
