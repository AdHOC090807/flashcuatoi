import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { db } from '@/db';
import { speakText } from '@/features/tts';
import { getDisplayKana } from '@/features/japanese';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import { RatingBar } from '@/components/study/RatingBar';
import type { Card, ReviewRating, StudyDirection } from '@/types';
import { cn } from '@/lib/utils';

interface FlipCardModeProps {
  card: Card;
  isJapanese?: boolean;
  showKanji?: boolean;
  direction?: StudyDirection;
  ttsAutoplay?: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRate: (rating: ReviewRating) => void;
}

export function FlipCardMode({
  card,
  isJapanese = false,
  showKanji = false,
  direction = 'term_to_meaning',
  ttsAutoplay = false,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onRate,
}: FlipCardModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [flipped, setFlipped] = useState(false);

  const ttsLang = isJapanese ? 'ja-JP' : settings?.ttsLang || 'en-US';
  const spokenTerm = isJapanese ? getDisplayKana(card) : card.term;

  useEffect(() => {
    setFlipped(false);
    if (isJapanese && (ttsAutoplay || direction === 'listen_to_term')) {
      speakText(spokenTerm, {
        voiceURI: settings?.ttsVoiceURI,
        lang: 'ja-JP',
        rate: settings?.ttsRate ?? 1.0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        onNext();
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        onRate(Number(e.key) as ReviewRating);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flipped, canGoPrev, canGoNext, onPrev, onNext, onRate]);

  const frontTitle =
    direction === 'meaning_to_term' ? (
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{card.meaning}</h2>
    ) : direction === 'listen_to_term' ? (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('study.listenPrompt')}</p>
        <TtsButton text={spokenTerm} lang={ttsLang} size="lg" label={t('study.listenPlay')} />
      </div>
    ) : isJapanese ? (
      <>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <JapaneseTerm card={card} showKanji={showKanji} />
        </h2>
        {(card.romaji || card.phonetic) && (
          <p className="mt-2 font-mono text-base text-muted-foreground">
            {card.romaji || card.phonetic}
          </p>
        )}
      </>
    ) : (
      <>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{card.term}</h2>
        {card.phonetic && (
          <p className="mt-2 font-mono text-base text-muted-foreground">{card.phonetic}</p>
        )}
      </>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="perspective-1000 h-[340px] sm:h-[380px]">
        <div
          role="button"
          tabIndex={0}
          aria-label={
            flipped ? `${spokenTerm}: ${card.meaning}` : `${spokenTerm}. ${t('study.showAnswer')}`
          }
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          className={cn(
            'flip-card-inner cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            flipped && 'is-flipped'
          )}
        >
          {/* Front */}
          <div className="flip-card-face flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-md sm:p-8">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`cards.status.${card.status}`)}</Badge>
                {(card.wordType || card.partOfSpeech) && (
                  <Badge variant="outline">{card.wordType || card.partOfSpeech}</Badge>
                )}
                {card.lesson && (
                  <Badge variant="outline">{t('japanese.lessonBadge', { num: card.lesson })}</Badge>
                )}
              </div>
              <TtsButton text={spokenTerm} lang={ttsLang} />
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              {frontTitle}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <RotateCw className="h-3.5 w-3.5" />
              <span>{t('study.showAnswer')}</span>
            </div>
          </div>

          {/* Back */}
          <div className="flip-card-face flip-card-back flex flex-col justify-between overflow-y-auto rounded-2xl border border-primary/30 bg-card p-6 shadow-md sm:p-8">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-primary">
                  {isJapanese ? <JapaneseTerm card={card} showKanji={showKanji} /> : card.term}
                </p>
                {(card.romaji || card.phonetic) && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {card.romaji || card.phonetic}
                  </p>
                )}
              </div>
              <TtsButton text={card.example || spokenTerm} lang={ttsLang} />
            </div>

            <div className="my-4 space-y-3 text-center">
              {direction === 'meaning_to_term' && isJapanese ? (
                <p className="text-2xl font-bold text-foreground sm:text-3xl">
                  <JapaneseTerm card={card} showKanji={showKanji} />
                </p>
              ) : (
                <p className="text-2xl font-bold text-foreground sm:text-3xl">{card.meaning}</p>
              )}

              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt={spokenTerm}
                  className="mx-auto max-h-28 rounded-lg object-cover"
                />
              )}

              {card.example && (
                <div className="mx-auto max-w-lg rounded-xl bg-muted/60 p-3 text-sm">
                  <p
                    lang={isJapanese ? 'ja' : undefined}
                    className={cn('italic text-foreground', isJapanese && 'not-italic font-jp')}
                  >
                    “{card.example}”
                  </p>
                  {card.exampleTranslation && (
                    <p className="mt-1 text-xs text-muted-foreground">{card.exampleTranslation}</p>
                  )}
                </div>
              )}

              {isJapanese && card.verbForms && (
                <div
                  lang="ja"
                  className="mx-auto flex max-w-lg flex-wrap justify-center gap-2 text-xs font-jp"
                >
                  {card.verbForms.masu && (
                    <Badge variant="outline">ます: {card.verbForms.masu}</Badge>
                  )}
                  {card.verbForms.te && <Badge variant="outline">て: {card.verbForms.te}</Badge>}
                  {card.verbForms.ta && <Badge variant="outline">た: {card.verbForms.ta}</Badge>}
                  {card.verbForms.nai && (
                    <Badge variant="outline">ない: {card.verbForms.nai}</Badge>
                  )}
                </div>
              )}

              {card.notes && <p className="text-xs text-muted-foreground">📝 {card.notes}</p>}
            </div>

            <div className="flex flex-wrap justify-center gap-1.5">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px]">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!flipped ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            disabled={!canGoPrev}
            onClick={onPrev}
            aria-label={t('common.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="lg" className="flex-1 max-w-xs" onClick={() => setFlipped(true)}>
            {t('study.showAnswer')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!canGoNext}
            onClick={onNext}
            aria-label={t('common.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <RatingBar card={card} onRate={onRate} />
      )}

      <p className="text-center text-xs text-muted-foreground">{t('study.flipHint')}</p>
    </div>
  );
}
