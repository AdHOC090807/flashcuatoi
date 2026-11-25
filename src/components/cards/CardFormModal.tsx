import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { db } from '@/db';
import { createCard, findDuplicateTerm, updateCard } from '@/db/actions';
import { suggestCardFieldsWithAI } from '@/features/ai';
import { useToastStore } from '@/store/useToastStore';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { Card } from '@/types';

interface CardFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  editingCard?: Card | null;
}

export function CardFormModal({ open, onOpenChange, deckId, editingCard }: CardFormModalProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [term, setTerm] = useState('');
  const [meaning, setMeaning] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [example, setExample] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [duplicateFound, setDuplicateFound] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (editingCard) {
      setTerm(editingCard.term);
      setMeaning(editingCard.meaning);
      setPhonetic(editingCard.phonetic);
      setPartOfSpeech(editingCard.partOfSpeech);
      setExample(editingCard.example);
      setExampleTranslation(editingCard.exampleTranslation);
      setNotes(editingCard.notes);
      setImageUrl(editingCard.imageUrl);
      setTagsRaw(editingCard.tags.join(', '));
    } else {
      setTerm('');
      setMeaning('');
      setPhonetic('');
      setPartOfSpeech('');
      setExample('');
      setExampleTranslation('');
      setNotes('');
      setImageUrl('');
      setTagsRaw('');
    }
    setDuplicateFound(false);
  }, [editingCard, open]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!open || !term.trim()) {
        if (active) setDuplicateFound(false);
        return;
      }
      const dup = await findDuplicateTerm(deckId, term, editingCard?.id);
      if (active) setDuplicateFound(Boolean(dup));
    };
    const timer = setTimeout(check, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, deckId, editingCard?.id, open]);

  const handleAI = async () => {
    if (!settings) return;
    setAiLoading(true);
    try {
      const suggested = await suggestCardFieldsWithAI(term, settings);
      if (!meaning.trim() && suggested.meaning) setMeaning(suggested.meaning);
      if (!phonetic.trim() && suggested.phonetic) setPhonetic(suggested.phonetic);
      if (!partOfSpeech.trim() && suggested.partOfSpeech) setPartOfSpeech(suggested.partOfSpeech);
      if (!example.trim() && suggested.example) setExample(suggested.example);
      if (!exampleTranslation.trim() && suggested.exampleTranslation) {
        setExampleTranslation(suggested.exampleTranslation);
      }
      pushToast({ title: t('cards.aiAutoFill'), description: term.trim(), variant: 'success' });
    } catch (err) {
      pushToast({
        title: t('cards.aiAutoFill'),
        description: err instanceof Error ? err.message : 'AI assist unavailable',
        variant: 'warning',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !meaning.trim()) return;

    const tags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      deckId,
      term,
      meaning,
      phonetic,
      partOfSpeech,
      example,
      exampleTranslation,
      notes,
      imageUrl,
      tags,
    };

    if (editingCard) {
      await updateCard(editingCard.id, payload);
      pushToast({ title: t('cards.editCard'), description: term.trim(), variant: 'success' });
    } else {
      await createCard(payload);
      pushToast({ title: t('cards.addCard'), description: term.trim(), variant: 'success' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editingCard ? t('cards.editCard') : t('cards.addCard')}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="card-term" className="mb-1 block text-sm font-medium">
                {t('cards.term')} *
              </label>
              <Input
                id="card-term"
                required
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. resilient"
              />
            </div>
            {settings?.aiEnabled && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleAI}
                disabled={aiLoading || !term.trim()}
              >
                <Sparkles className="h-4 w-4" />
                <span>{aiLoading ? t('cards.aiLoading') : t('cards.aiAutoFill')}</span>
              </Button>
            )}
          </div>

          {duplicateFound && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{t('cards.duplicateWarning')}</span>
            </div>
          )}

          <div>
            <label htmlFor="card-meaning" className="mb-1 block text-sm font-medium">
              {t('cards.meaning')} *
            </label>
            <Input
              id="card-meaning"
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="e.g. kiên cường, mau phục hồi"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="card-phonetic" className="mb-1 block text-sm font-medium">
                {t('cards.phonetic')}
              </label>
              <Input
                id="card-phonetic"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                placeholder="/rɪˈzɪliənt/"
              />
            </div>
            <div>
              <label htmlFor="card-pos" className="mb-1 block text-sm font-medium">
                {t('cards.partOfSpeech')}
              </label>
              <Input
                id="card-pos"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                placeholder="noun, verb, adjective..."
              />
            </div>
          </div>

          <div>
            <label htmlFor="card-example" className="mb-1 block text-sm font-medium">
              {t('cards.example')}
            </label>
            <Textarea
              id="card-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Children are remarkably resilient after setbacks."
              className="min-h-[60px]"
            />
          </div>

          <div>
            <label htmlFor="card-example-trans" className="mb-1 block text-sm font-medium">
              {t('cards.exampleTranslation')}
            </label>
            <Input
              id="card-example-trans"
              value={exampleTranslation}
              onChange={(e) => setExampleTranslation(e.target.value)}
              placeholder="Trẻ em có khả năng phục hồi đáng kinh ngạc..."
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="card-image" className="mb-1 block text-sm font-medium">
                {t('cards.imageUrl')}
              </label>
              <Input
                id="card-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label htmlFor="card-tags" className="mb-1 block text-sm font-medium">
                {t('cards.tags')}
              </label>
              <Input
                id="card-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="ielts, daily"
              />
            </div>
          </div>

          <div>
            <label htmlFor="card-notes" className="mb-1 block text-sm font-medium">
              {t('cards.notes')}
            </label>
            <Textarea
              id="card-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Synonyms, memory cues..."
              className="min-h-[60px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{editingCard ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
