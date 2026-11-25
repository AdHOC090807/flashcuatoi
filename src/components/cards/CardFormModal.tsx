import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { db } from '@/db';
import { createCard, findDuplicateTerm, updateCard } from '@/db/actions';
import { suggestCardFieldsWithAI } from '@/features/ai';
import { kanaToRomaji } from '@/features/japanese';
import { useToastStore } from '@/store/useToastStore';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { Card, JapaneseWordType } from '@/types';

const JA_WORD_TYPES: JapaneseWordType[] = [
  'noun',
  'verb',
  'i-adj',
  'na-adj',
  'adverb',
  'particle',
  'expression',
];

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
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId]);
  const isJapanese = deck?.language === 'ja';

  const [term, setTerm] = useState('');
  const [meaning, setMeaning] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [example, setExample] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');

  // Japanese-specific fields
  const [kana, setKana] = useState('');
  const [romaji, setRomaji] = useState('');
  const [romajiEditedManually, setRomajiEditedManually] = useState(false);
  const [kanji, setKanji] = useState('');
  const [wordType, setWordType] = useState<string>('noun');
  const [lesson, setLesson] = useState<string>('');
  const [masuForm, setMasuForm] = useState('');
  const [teForm, setTeForm] = useState('');
  const [taForm, setTaForm] = useState('');
  const [naiForm, setNaiForm] = useState('');

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
      setKana(editingCard.kana || editingCard.term);
      setRomaji(editingCard.romaji || kanaToRomaji(editingCard.kana || editingCard.term));
      setRomajiEditedManually(Boolean(editingCard.romaji));
      setKanji(editingCard.kanji || '');
      setWordType(editingCard.wordType || editingCard.partOfSpeech || 'noun');
      setLesson(editingCard.lesson ? String(editingCard.lesson) : '');
      setMasuForm(editingCard.verbForms?.masu || '');
      setTeForm(editingCard.verbForms?.te || '');
      setTaForm(editingCard.verbForms?.ta || '');
      setNaiForm(editingCard.verbForms?.nai || '');
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
      setKana('');
      setRomaji('');
      setRomajiEditedManually(false);
      setKanji('');
      setWordType('noun');
      setLesson('');
      setMasuForm('');
      setTeForm('');
      setTaForm('');
      setNaiForm('');
    }
    setDuplicateFound(false);
  }, [editingCard, open]);

  const activeTerm = isJapanese ? kana : term;

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!open || !activeTerm.trim()) {
        if (active) setDuplicateFound(false);
        return;
      }
      const dup = await findDuplicateTerm(deckId, activeTerm, editingCard?.id);
      if (active) setDuplicateFound(Boolean(dup));
    };
    const timer = setTimeout(check, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeTerm, deckId, editingCard?.id, open]);

  const handleKanaChange = (val: string) => {
    setKana(val);
    if (!romajiEditedManually) {
      setRomaji(kanaToRomaji(val));
    }
  };

  const handleAI = async () => {
    if (!settings) return;
    setAiLoading(true);
    try {
      const suggested = await suggestCardFieldsWithAI(activeTerm, settings);
      if (!meaning.trim() && suggested.meaning) setMeaning(suggested.meaning);
      if (!phonetic.trim() && suggested.phonetic) setPhonetic(suggested.phonetic);
      if (!partOfSpeech.trim() && suggested.partOfSpeech) setPartOfSpeech(suggested.partOfSpeech);
      if (!example.trim() && suggested.example) setExample(suggested.example);
      if (!exampleTranslation.trim() && suggested.exampleTranslation) {
        setExampleTranslation(suggested.exampleTranslation);
      }
      pushToast({
        title: t('cards.aiAutoFill'),
        description: activeTerm.trim(),
        variant: 'success',
      });
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
    if (!activeTerm.trim() || !meaning.trim()) return;

    const tags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedLesson = lesson.trim() ? Math.min(50, Math.max(1, Number(lesson))) : undefined;
    const verbForms =
      isJapanese &&
      wordType === 'verb' &&
      (masuForm.trim() || teForm.trim() || taForm.trim() || naiForm.trim())
        ? {
            masu: masuForm.trim() || undefined,
            te: teForm.trim() || undefined,
            ta: taForm.trim() || undefined,
            nai: naiForm.trim() || undefined,
          }
        : undefined;

    const payload = isJapanese
      ? {
          deckId,
          term: kana.trim(),
          meaning,
          phonetic: romaji.trim() || kanaToRomaji(kana),
          partOfSpeech: wordType,
          example,
          exampleTranslation,
          notes,
          imageUrl,
          tags,
          kana: kana.trim(),
          romaji: romaji.trim() || kanaToRomaji(kana),
          kanji: kanji.trim() || undefined,
          wordType,
          lesson: Number.isNaN(parsedLesson) ? undefined : parsedLesson,
          verbForms,
        }
      : {
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
      pushToast({
        title: t('cards.editCard'),
        description: activeTerm.trim(),
        variant: 'success',
      });
    } else {
      await createCard(payload);
      pushToast({
        title: t('cards.addCard'),
        description: activeTerm.trim(),
        variant: 'success',
      });
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
          {isJapanese ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="card-kana" className="mb-1 block text-sm font-medium">
                    {t('japanese.kana')} *
                  </label>
                  <Input
                    id="card-kana"
                    lang="ja"
                    required
                    value={kana}
                    onChange={(e) => handleKanaChange(e.target.value)}
                    placeholder="e.g. たべる"
                    className="font-jp"
                  />
                </div>
                {settings?.aiEnabled && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAI}
                    disabled={aiLoading || !kana.trim()}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="card-romaji" className="mb-1 block text-sm font-medium">
                    {t('japanese.romaji')}
                  </label>
                  <Input
                    id="card-romaji"
                    value={romaji}
                    onChange={(e) => {
                      setRomaji(e.target.value);
                      setRomajiEditedManually(true);
                    }}
                    placeholder="taberu"
                  />
                </div>
                <div>
                  <label htmlFor="card-kanji" className="mb-1 block text-sm font-medium">
                    {t('japanese.kanjiOptional')}
                  </label>
                  <Input
                    id="card-kanji"
                    lang="ja"
                    value={kanji}
                    onChange={(e) => setKanji(e.target.value)}
                    placeholder="e.g. 食べる (optional)"
                    className="font-jp"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="card-meaning" className="mb-1 block text-sm font-medium">
                  {t('cards.meaning')} *
                </label>
                <Input
                  id="card-meaning"
                  required
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="e.g. ăn"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="card-word-type" className="mb-1 block text-sm font-medium">
                    {t('japanese.wordType')}
                  </label>
                  <select
                    id="card-word-type"
                    value={wordType}
                    onChange={(e) => setWordType(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {JA_WORD_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {t(`japanese.wordTypes.${wt}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="card-lesson" className="mb-1 block text-sm font-medium">
                    {t('japanese.lessonNumber')}
                  </label>
                  <Input
                    id="card-lesson"
                    type="number"
                    min={1}
                    max={50}
                    value={lesson}
                    onChange={(e) => setLesson(e.target.value)}
                    placeholder="1..50"
                  />
                </div>
              </div>

              {wordType === 'verb' && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('japanese.verbForms')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      lang="ja"
                      value={masuForm}
                      onChange={(e) => setMasuForm(e.target.value)}
                      placeholder="ます (e.g. たべます)"
                      aria-label="Masu form"
                      className="font-jp"
                    />
                    <Input
                      lang="ja"
                      value={teForm}
                      onChange={(e) => setTeForm(e.target.value)}
                      placeholder="て (e.g. たべて)"
                      aria-label="Te form"
                      className="font-jp"
                    />
                    <Input
                      lang="ja"
                      value={taForm}
                      onChange={(e) => setTaForm(e.target.value)}
                      placeholder="た (e.g. たべた)"
                      aria-label="Ta form"
                      className="font-jp"
                    />
                    <Input
                      lang="ja"
                      value={naiForm}
                      onChange={(e) => setNaiForm(e.target.value)}
                      placeholder="ない (e.g. たべない)"
                      aria-label="Nai form"
                      className="font-jp"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

          <div>
            <label htmlFor="card-example" className="mb-1 block text-sm font-medium">
              {t('cards.example')}
            </label>
            <Textarea
              id="card-example"
              lang={isJapanese ? 'ja' : undefined}
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder={
                isJapanese
                  ? 'e.g. まいにちりんごをたべます。'
                  : 'Children are remarkably resilient after setbacks.'
              }
              className={isJapanese ? 'min-h-[60px] font-jp' : 'min-h-[60px]'}
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
