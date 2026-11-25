import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, XCircle } from 'lucide-react';
import { db } from '@/db';
import { buildJapaneseSampleCards, SAMPLE_WORDS } from '@/db/seed';
import { getDisplayKana, pickJapaneseQuizDistractors } from '@/features/japanese';
import { debouncedPlayTTS, resolveTTSProvider, stopSpeaking } from '@/features/tts';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import type { Card, ReviewRating, StudyDirection } from '@/types';
import { cn } from '@/lib/utils';

interface QuizModeProps {
  card: Card;
  deckCards: Card[];
  isJapanese?: boolean;
  showKanji?: boolean;
  direction?: StudyDirection;
  ttsAutoplay?: boolean;
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function QuizMode({
  card,
  deckCards,
  isJapanese = false,
  showKanji = false,
  direction = 'term_to_meaning',
  ttsAutoplay = false,
  onAnswered,
}: QuizModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ttsLang = isJapanese ? 'ja-JP' : settings?.ttsLang || 'en-US';
  const spokenTerm = isJapanese ? getDisplayKana(card) : card.term;
  const pickJapaneseOption = isJapanese && direction !== 'term_to_meaning';

  useEffect(() => {
    setSelectedId(null);
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

  const options = useMemo(() => {
    if (isJapanese) {
      let distractorCards = pickJapaneseQuizDistractors(card, deckCards, 3);
      if (distractorCards.length < 3) {
        const extra = pickJapaneseQuizDistractors(
          card,
          buildJapaneseSampleCards(),
          3 - distractorCards.length
        );
        const usedIds = new Set([card.id, ...distractorCards.map((d) => d.id)]);
        for (const ex of extra) {
          if (!usedIds.has(ex.id) && distractorCards.length < 3) {
            distractorCards = [...distractorCards, ex];
            usedIds.add(ex.id);
          }
        }
      }

      const rawOpts = [
        { id: card.id, card, isCorrect: true },
        ...distractorCards.map((d) => ({ id: d.id, card: d, isCorrect: false })),
      ];
      return rawOpts.sort(() => Math.random() - 0.5);
    }

    const distractors = deckCards
      .filter((c) => c.id !== card.id && c.meaning.trim() !== card.meaning.trim())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (distractors.length < 3) {
      const existingTexts = new Set([card.meaning, ...distractors.map((d) => d.meaning)]);
      for (const sample of SAMPLE_WORDS) {
        if (distractors.length >= 3) break;
        if (!existingTexts.has(sample.meaning)) {
          existingTexts.add(sample.meaning);
          distractors.push({
            ...card,
            id: `fallback_${sample.term}`,
            term: sample.term,
            meaning: sample.meaning,
          });
        }
      }
    }

    return [
      { id: card.id, card, isCorrect: true },
      ...distractors.map((d) => ({ id: d.id, card: d, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);
  }, [card, deckCards, isJapanese]);

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
              {pickJapaneseOption ? t('japanese.chooseKana') : t('study.quizPrompt')}
            </span>
            <TtsButton text={spokenTerm} lang={ttsLang} audioUrl={card.audioUrl} />
          </div>

          {direction === 'meaning_to_term' && isJapanese ? (
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{card.meaning}</h2>
          ) : direction === 'listen_to_term' && isJapanese ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <TtsButton text={spokenTerm} lang="ja-JP" size="lg" label={t('study.listenPlay')} />
            </div>
          ) : isJapanese ? (
            <>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                <JapaneseTerm card={card} showKanji={showKanji} />
              </h2>
              {(card.romaji || card.phonetic) && (
                <p className="mt-1.5 font-mono text-sm text-muted-foreground">
                  {card.romaji || card.phonetic}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{card.term}</h2>
              {card.phonetic && (
                <p className="mt-1.5 font-mono text-sm text-muted-foreground">{card.phonetic}</p>
              )}
            </>
          )}
        </CardContent>
      </UiCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id;
          const showResult = selectedId !== null;
          return (
            <Button
              key={`${card.id}-${opt.id}`}
              variant="outline"
              onClick={(e) => {
                e.currentTarget.blur();
                choose(opt);
              }}
              disabled={showResult}
              className={cn(
                'h-auto min-h-[64px] justify-between px-4 py-3 text-left whitespace-normal touch-manipulation select-none',
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
                <span className="text-sm font-medium">
                  {pickJapaneseOption ? (
                    <JapaneseTerm card={opt.card} showKanji={showKanji} />
                  ) : (
                    opt.card.meaning
                  )}
                </span>
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
