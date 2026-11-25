import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, XCircle } from 'lucide-react';
import { db } from '@/db';
import { getDisplayKana, isJapaneseMatch } from '@/features/japanese';
import { debouncedPlayTTS, resolveTTSProvider, stopSpeaking } from '@/features/tts';
import { isTolerantMatch } from '@/lib/utils';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import type { Card, ReviewRating, StudyDirection } from '@/types';

interface TypingModeProps {
  card: Card;
  isJapanese?: boolean;
  showKanji?: boolean;
  direction?: StudyDirection;
  ttsAutoplay?: boolean;
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function TypingMode({
  card,
  isJapanese = false,
  showKanji = false,
  direction = 'meaning_to_term',
  ttsAutoplay = false,
  onAnswered,
}: TypingModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<{
    isMatch: boolean;
    isExact: boolean;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ttsLang = isJapanese ? 'ja-JP' : settings?.ttsLang || 'en-US';
  const spokenTerm = isJapanese ? getDisplayKana(card) : card.term;
  const expectMeaning = isJapanese && direction === 'term_to_meaning';

  useEffect(() => {
    setAnswer('');
    setChecked(null);
    inputRef.current?.focus();
    if (ttsAutoplay || direction === 'listen_to_term') {
      debouncedPlayTTS(spokenTerm, {
        voiceURI: settings?.ttsVoiceURI,
        lang: ttsLang,
        rate: settings?.ttsRate ?? 1.0,
        audioUrl: card.audioUrl,
        provider: resolveTTSProvider(settings),
        elevenLabsApiKey: settings?.elevenLabsApiKey,
        elevenLabsVoiceId: settings?.elevenLabsVoiceId,
        elevenLabsModel: settings?.elevenLabsModel,
      });
    }
    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, direction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || checked) return;

    if (isJapanese && !expectMeaning) {
      const res = isJapaneseMatch(answer, card);
      setChecked({ isMatch: res.isMatch, isExact: res.isExact });
      return;
    }

    const expectedText = expectMeaning ? card.meaning : card.term;
    const result = isTolerantMatch(answer, expectedText);
    setChecked({ isMatch: result.isMatch, isExact: result.isExact });
  };

  const handleContinue = () => {
    if (!checked) return;
    const rating: ReviewRating = checked.isExact ? 4 : checked.isMatch ? 3 : 1;
    onAnswered(rating, checked.isMatch);
  };

  const expectedLabel = expectMeaning ? card.meaning : spokenTerm;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <UiCard>
        <CardContent className="p-6 text-center sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isJapanese && !expectMeaning
                ? t('japanese.typingKanaOrRomaji')
                : t('study.typingPrompt')}
            </span>
            <TtsButton text={spokenTerm} lang={ttsLang} audioUrl={card.audioUrl} />
          </div>

          {expectMeaning ? (
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
              <JapaneseTerm card={card} showKanji={showKanji} />
            </h2>
          ) : isJapanese && direction === 'listen_to_term' ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <TtsButton text={spokenTerm} lang="ja-JP" size="lg" label={t('study.listenPlay')} />
            </div>
          ) : (
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">{card.meaning}</h2>
          )}

          {(card.wordType || card.partOfSpeech) && (
            <p className="mt-1 text-xs text-muted-foreground">
              ({card.wordType || card.partOfSpeech})
            </p>
          )}
          {!isJapanese && card.example && (
            <p className="mt-3 text-sm italic text-muted-foreground">
              “{card.example.replace(new RegExp(card.term, 'gi'), '_____')}”
            </p>
          )}
        </CardContent>
      </UiCard>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          ref={inputRef}
          lang={isJapanese && !expectMeaning ? 'ja' : undefined}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={Boolean(checked)}
          placeholder={
            isJapanese && !expectMeaning
              ? t('japanese.typingPlaceholder')
              : t('study.typingPlaceholder')
          }
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
                      : t('study.incorrectAnswer', { expected: expectedLabel })}
                </p>
                {isJapanese ? (
                  <p lang="ja" className="text-xs opacity-80 font-jp">
                    {spokenTerm}
                    {card.romaji ? ` (${card.romaji})` : ''} — {card.meaning}
                  </p>
                ) : (
                  card.phonetic && <p className="font-mono text-xs opacity-80">{card.phonetic}</p>
                )}
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
