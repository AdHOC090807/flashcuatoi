import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import { isJapaneseMatch, kanaToRomaji } from '@/features/japanese';
import type { Card, ReviewRating, VerbForms } from '@/types';

type VerbFormKey = keyof VerbForms;

const FORM_LABELS: Record<VerbFormKey, { label: string; hint: string }> = {
  masu: { label: 'ます形 (Polite present)', hint: '-masu' },
  te: { label: 'て形 (Te-form)', hint: '-te' },
  ta: { label: 'た形 (Past casual)', hint: '-ta' },
  nai: { label: 'ない形 (Negative casual)', hint: '-nai' },
};

interface ConjugationDrillModeProps {
  card: Card;
  showKanji: boolean;
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function ConjugationDrillMode({ card, showKanji, onAnswered }: ConjugationDrillModeProps) {
  const { t } = useTranslation();
  const availableForms = useMemo<VerbFormKey[]>(() => {
    const vf = card.verbForms;
    if (!vf) return [];
    return (['masu', 'te', 'ta', 'nai'] as VerbFormKey[]).filter((k) => Boolean(vf[k]?.trim()));
  }, [card]);

  const targetForm = useMemo<VerbFormKey | null>(() => {
    if (availableForms.length === 0) return null;
    return availableForms[Math.floor(Math.random() * availableForms.length)];
  }, [availableForms]);

  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<{
    isMatch: boolean;
    expected: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAnswer('');
    setChecked(null);
    inputRef.current?.focus();
  }, [card.id, targetForm]);

  if (!targetForm || !card.verbForms?.[targetForm]) {
    return (
      <UiCard className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">{t('japanese.noVerbForms')}</p>
          <Button onClick={() => onAnswered(3, true)}>{t('common.skip')}</Button>
        </CardContent>
      </UiCard>
    );
  }

  const expected = card.verbForms[targetForm]!;
  const meta = FORM_LABELS[targetForm];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || checked) return;
    const res = isJapaneseMatch(answer, expected);
    setChecked({ isMatch: res.isMatch, expected });
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <UiCard>
        <CardContent className="p-6 text-center sm:p-8 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="default">{meta.label}</Badge>
            <TtsButton text={card.kana || card.term} lang="ja-JP" />
          </div>

          <h2 className="pt-2 text-3xl font-bold sm:text-4xl">
            <JapaneseTerm card={card} showKanji={showKanji} />
          </h2>
          <p className="text-sm text-muted-foreground">
            {card.romaji} • {card.meaning}
          </p>
        </CardContent>
      </UiCard>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          ref={inputRef}
          lang="ja"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={Boolean(checked)}
          placeholder={t('japanese.conjugationPlaceholder', { form: meta.hint })}
          className="h-12 text-base font-jp"
          autoComplete="off"
        />

        {!checked ? (
          <Button type="submit" size="lg" className="w-full" disabled={!answer.trim()}>
            {t('study.checkAnswer')}
          </Button>
        ) : (
          <div className="space-y-3">
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm ${
                checked.isMatch
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {checked.isMatch ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0" />
                )}
                <div>
                  <p lang="ja" className="font-semibold font-jp">
                    {checked.expected} ({kanaToRomaji(checked.expected)})
                  </p>
                </div>
              </div>
              <TtsButton text={checked.expected} lang="ja-JP" size="sm" />
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => onAnswered(checked.isMatch ? 3 : 1, checked.isMatch)}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
