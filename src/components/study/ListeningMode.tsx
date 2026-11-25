import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Volume2, XCircle } from 'lucide-react';
import { db } from '@/db';
import { speakText } from '@/features/tts';
import { SAMPLE_WORDS } from '@/db/seed';
import { isTolerantMatch, cn } from '@/lib/utils';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Card, ReviewRating } from '@/types';

interface ListeningModeProps {
  card: Card;
  deckCards: Card[];
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function ListeningMode({ card, deckCards, onAnswered }: ListeningModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [subMode, setSubMode] = useState<'pick' | 'type'>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<boolean | null>(null);

  const playAudio = () => {
    speakText(card.term, {
      voiceURI: settings?.ttsVoiceURI,
      lang: settings?.ttsLang || 'en-US',
      rate: settings?.ttsRate ?? 1.0,
    });
  };

  useEffect(() => {
    setSelectedId(null);
    setTyped('');
    setTypedResult(null);
    playAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const options = useMemo(() => {
    const distractors = deckCards
      .filter((c) => c.id !== card.id && c.meaning.trim() !== card.meaning.trim())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => ({ id: c.id, text: c.meaning, isCorrect: false }));

    if (distractors.length < 3) {
      const seen = new Set([card.meaning, ...distractors.map((d) => d.text)]);
      for (const sample of SAMPLE_WORDS) {
        if (distractors.length >= 3) break;
        if (!seen.has(sample.meaning)) {
          seen.add(sample.meaning);
          distractors.push({ id: `fb_${sample.term}`, text: sample.meaning, isCorrect: false });
        }
      }
    }

    return [{ id: card.id, text: card.meaning, isCorrect: true }, ...distractors].sort(
      () => Math.random() - 0.5
    );
  }, [card, deckCards]);

  const handlePick = (opt: { id: string; isCorrect: boolean }) => {
    if (selectedId) return;
    setSelectedId(opt.id);
    setTimeout(() => {
      onAnswered(opt.isCorrect ? 3 : 1, opt.isCorrect);
    }, 900);
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || typedResult !== null) return;
    const res = isTolerantMatch(typed, card.term);
    setTypedResult(res.isMatch);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex justify-center gap-2">
        <Button
          size="sm"
          variant={subMode === 'pick' ? 'default' : 'outline'}
          onClick={() => setSubMode('pick')}
        >
          {t('study.listenModePick')}
        </Button>
        <Button
          size="sm"
          variant={subMode === 'type' ? 'default' : 'outline'}
          onClick={() => setSubMode('type')}
        >
          {t('study.listenModeType')}
        </Button>
      </div>

      <UiCard>
        <CardContent className="flex flex-col items-center p-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('study.listenPrompt')}
          </p>
          <Button
            size="lg"
            onClick={playAudio}
            className="mt-5 h-16 w-16 rounded-full shadow-md"
            aria-label={t('study.listenPlay')}
          >
            <Volume2 className="h-7 w-7" />
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">{t('study.listenPlay')}</p>
        </CardContent>
      </UiCard>

      {subMode === 'pick' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const isSelected = selectedId === opt.id;
            const showResult = selectedId !== null;
            return (
              <Button
                key={opt.id}
                variant="outline"
                disabled={showResult}
                onClick={() => handlePick(opt)}
                className={cn(
                  'h-auto min-h-[60px] justify-between px-4 py-3 text-left whitespace-normal',
                  showResult &&
                    opt.isCorrect &&
                    'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                  showResult &&
                    isSelected &&
                    !opt.isCorrect &&
                    'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200'
                )}
              >
                <span className="text-sm font-medium">{opt.text}</span>
                {showResult && opt.isCorrect && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {showResult && isSelected && !opt.isCorrect && (
                  <XCircle className="h-4 w-4 text-rose-600" />
                )}
              </Button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleTypeSubmit} className="space-y-3">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={typedResult !== null}
            placeholder={t('study.typingPlaceholder')}
            className="h-12 text-base"
          />
          {typedResult === null ? (
            <Button type="submit" size="lg" className="w-full" disabled={!typed.trim()}>
              {t('study.checkAnswer')}
            </Button>
          ) : (
            <div className="space-y-3">
              <div
                className={`rounded-xl border p-4 text-sm ${
                  typedResult
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                }`}
              >
                <p className="font-semibold">
                  {typedResult
                    ? `${t('study.exactMatch')} (${card.term} — ${card.meaning})`
                    : `${t('study.incorrectAnswer', { expected: card.term })} (${card.meaning})`}
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => onAnswered(typedResult ? 3 : 1, typedResult)}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
