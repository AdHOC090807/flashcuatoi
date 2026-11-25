import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TtsButton } from '@/components/cards/TtsButton';
import { SAMPLE_WORDS } from '@/db/seed';
import type { Card, ReviewRating } from '@/types';
import { cn } from '@/lib/utils';

interface QuizModeProps {
  card: Card;
  deckCards: Card[];
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function QuizMode({ card, deckCards, onAnswered }: QuizModeProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [card.id]);

  const options = useMemo(() => {
    const distractors = deckCards
      .filter((c) => c.id !== card.id && c.meaning.trim() !== card.meaning.trim())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => ({ id: c.id, text: c.meaning, isCorrect: false }));

    // Fallback distractors if deck has fewer than 4 distinct cards
    if (distractors.length < 3) {
      const existingTexts = new Set([card.meaning, ...distractors.map((d) => d.text)]);
      for (const sample of SAMPLE_WORDS) {
        if (distractors.length >= 3) break;
        if (!existingTexts.has(sample.meaning)) {
          existingTexts.add(sample.meaning);
          distractors.push({
            id: `fallback_${sample.term}`,
            text: sample.meaning,
            isCorrect: false,
          });
        }
      }
    }

    return [{ id: card.id, text: card.meaning, isCorrect: true }, ...distractors].sort(
      () => Math.random() - 0.5
    );
  }, [card, deckCards]);

  const choose = (opt: { id: string; isCorrect: boolean }) => {
    if (selectedId) return;
    setSelectedId(opt.id);
    setTimeout(() => {
      onAnswered(opt.isCorrect ? 3 : 1, opt.isCorrect);
    }, 850);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedId) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx !== -1 && options[idx]) {
        e.preventDefault();
        choose(options[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, options]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <UiCard>
        <CardContent className="p-6 text-center sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('study.quizPrompt')}
            </span>
            <TtsButton text={card.term} />
          </div>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{card.term}</h2>
          {card.phonetic && (
            <p className="mt-1.5 font-mono text-sm text-muted-foreground">{card.phonetic}</p>
          )}
        </CardContent>
      </UiCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const showResult = selectedId !== null;
          return (
            <Button
              key={opt.id}
              variant="outline"
              onClick={() => choose(opt)}
              disabled={showResult}
              className={cn(
                'h-auto min-h-[64px] justify-between px-4 py-3 text-left whitespace-normal',
                showResult &&
                  opt.isCorrect &&
                  'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                showResult &&
                  isSelected &&
                  !opt.isCorrect &&
                  'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200'
              )}
            >
              <span className="flex items-center gap-3">
                <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </kbd>
                <span className="text-sm font-medium">{opt.text}</span>
              </span>
              {showResult && opt.isCorrect && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              )}
              {showResult && isSelected && !opt.isCorrect && (
                <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
