import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { createDeck, updateDeck } from '@/db/actions';
import { useToastStore } from '@/store/useToastStore';
import type { Deck, DeckLanguage } from '@/types';

const DECK_EMOJIS = ['📘', '🇯🇵', '📚', '🗣️', '🌍', '💡', '💼', '🎧', '✍️', '🧠', '🎯', '🌸'];
const DECK_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
];

interface DeckFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDeck?: Deck | null;
}

export function DeckFormModal({ open, onOpenChange, editingDeck }: DeckFormModalProps) {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<DeckLanguage>('en');
  const [emoji, setEmoji] = useState('📘');
  const [color, setColor] = useState('#4f46e5');
  const [tagsRaw, setTagsRaw] = useState('');

  useEffect(() => {
    if (editingDeck) {
      setName(editingDeck.name);
      setDescription(editingDeck.description);
      setLanguage(editingDeck.language || 'en');
      setEmoji(editingDeck.emoji);
      setColor(editingDeck.color);
      setTagsRaw(editingDeck.tags.join(', '));
    } else {
      setName('');
      setDescription('');
      setLanguage('en');
      setEmoji('📘');
      setColor('#4f46e5');
      setTagsRaw('');
    }
  }, [editingDeck, open]);

  const handleLanguageChange = (nextLang: DeckLanguage) => {
    setLanguage(nextLang);
    if (!editingDeck) {
      if (nextLang === 'ja' && emoji === '📘') setEmoji('🇯🇵');
      if (nextLang === 'en' && emoji === '🇯🇵') setEmoji('📘');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingDeck) {
      await updateDeck(editingDeck.id, { name, description, language, emoji, color, tags });
      pushToast({ title: t('decks.editDeck'), description: name.trim(), variant: 'success' });
    } else {
      await createDeck({ name, description, language, emoji, color, tags });
      pushToast({ title: t('decks.newDeck'), description: name.trim(), variant: 'success' });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editingDeck ? t('decks.editDeck') : t('decks.newDeck')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="deck-name" className="mb-1.5 block text-sm font-medium">
                {t('decks.name')} *
              </label>
              <Input
                id="deck-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  language === 'ja' ? 'e.g. Japanese N5 Core' : 'e.g. IELTS Academic Vocabulary'
                }
              />
            </div>

            <div>
              <label htmlFor="deck-language" className="mb-1.5 block text-sm font-medium">
                {t('decks.language')}
              </label>
              <select
                id="deck-language"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as DeckLanguage)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="en">{t('decks.langEn')}</option>
                <option value="ja">{t('decks.langJa')}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="deck-desc" className="mb-1.5 block text-sm font-medium">
              {t('decks.description')}
            </label>
            <Textarea
              id="deck-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of this deck..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-medium">{t('decks.emoji')}</span>
              <div className="flex flex-wrap gap-1.5">
                {DECK_EMOJIS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEmoji(item)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
                      emoji === item
                        ? 'border-primary bg-primary/15 ring-2 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium">{t('decks.color')}</span>
              <div className="flex flex-wrap gap-2">
                {DECK_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    onClick={() => setColor(swatch)}
                    className={`h-8 w-8 rounded-full transition ${
                      color === swatch
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                        : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="deck-tags" className="mb-1.5 block text-sm font-medium">
              {t('decks.tags')}
            </label>
            <Input
              id="deck-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="ielts, japanese, daily"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{editingDeck ? t('common.save') : t('common.create')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
