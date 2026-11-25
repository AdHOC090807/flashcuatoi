import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bulkCreateCards } from '@/db/actions';
import { useToastStore } from '@/store/useToastStore';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

interface BulkAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
}

export function BulkAddModal({ open, onOpenChange, deckId }: BulkAddModalProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);
  const [raw, setRaw] = useState('');
  const [dupMode, setDupMode] = useState<'skip' | 'update' | 'keep'>('skip');

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items = lines.map((line) => {
      const parts = line.split(/[|\t]/).map((p) => p.trim());
      return {
        term: parts[0] ?? '',
        meaning: parts[1] ?? '',
        phonetic: parts[2] ?? '',
        example: parts[3] ?? '',
      };
    });

    const result = await bulkCreateCards(deckId, items, dupMode);
    pushToast({
      title: t('cards.bulkAdd'),
      description: `+${result.added} added, ${result.updated} updated, ${result.skipped} skipped`,
      variant: 'success',
    });
    setRaw('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('cards.bulkAdd')}
        description={t('cards.bulkAddHelp')}
        className="max-w-xl"
      >
        <form onSubmit={handleImport} className="space-y-4">
          <Textarea
            rows={8}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={
              'resilient | kiên cường | /rɪˈzɪliənt/ | She is resilient.\nempathy | sự đồng cảm | /ˈempəθi/'
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('importExport.duplicates')}:</span>
              <select
                value={dupMode}
                onChange={(e) => setDupMode(e.target.value as 'skip' | 'update' | 'keep')}
                className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="skip">{t('importExport.dupSkip')}</option>
                <option value="update">{t('importExport.dupUpdate')}</option>
                <option value="keep">{t('importExport.dupKeep')}</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!raw.trim()}>
                {t('common.add')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
