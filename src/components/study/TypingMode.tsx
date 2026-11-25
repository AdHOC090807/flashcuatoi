import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TtsButton } from '@/components/cards/TtsButton';
import { isTolerantMatch } from '@/lib/utils';
import type { Card, ReviewRating } from '@/types';

interface TypingModeProps {
  card: Card;
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function TypingMode({ card, onAnswered }: TypingModeProps) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<{
    isMatch: boolean;
    isExact: boolean;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnswer('');
    setChecked(null);
    inputRef.current?.focus();
  }, [card.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || checked) return;

    const result = isTolerantMatch(answer, card.term);
    setChecked({ isMatch: result.isMatch, isExact: result.isExact });
  };

  const handleContinue = () => {
    if (!checked) return;
    const rating: ReviewRating = checked.isExact ? 4 : checked.isMatch ? 3 : 1;
    onAnswered(rating, checked.isMatch);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <UiCard>
        <CardContent className="p-6 text-center sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('study.typingPrompt')}
            </span>
            <TtsButton text={card.term} />
          </div>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">{card.meaning}</h2>
          {card.partOfSpeech && (
            <p className="mt-1 text-xs text-muted-foreground">({card.partOfSpeech})</p>
          )}
          {card.example && (
            <p className="mt-3 text-sm italic text-muted-foreground">
              “{card.example.replace(new RegExp(card.term, 'gi'), '_____')}”
            </p>
          )}
        </CardContent>
      </UiCard>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={Boolean(checked)}
          placeholder={t('study.typingPlaceholder')}
          className="h-12 text-base"
          autoComplete="off"
        />

        {!checked ? (
          <Button type="submit" size="lg" className="w-full" disabled={!answer.trim()}>
            {t('study.checkAnswer')}
          </Button>
        ) : (
          <div className="space-y-3">
            <div
              className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
                checked.isMatch
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
              }`}
            >
              {checked.isMatch ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {checked.isExact
                    ? t('study.exactMatch')
                    : checked.isMatch
                      ? t('study.closeMatch')
                      : t('study.incorrectAnswer', { expected: card.term })}
                </p>
                {card.phonetic && <p className="font-mono text-xs opacity-80">{card.phonetic}</p>}
              </div>
            </div>
            <Button type="button" size="lg" className="w-full" onClick={handleContinue}>
              {t('common.next')}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
