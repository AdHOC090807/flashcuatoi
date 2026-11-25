import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw } from 'lucide-react';
import { db } from '@/db';
import { debouncedPlayTTS, resolveTTSProvider, stopSpeaking } from '@/features/tts';
import { getDisplayKana } from '@/features/japanese';
import { RATING_TO_DIRECTION, type SwipeDirection } from '@/features/study/swipeDecision';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import { RatingBar } from '@/components/study/RatingBar';
import { SwipeableCard, type SwipeCommand } from '@/components/study/SwipeableCard';
import type { Card, ReviewRating, StudyDirection } from '@/types';

interface FlipCardModeProps {
  card: Card;
  upcomingCards?: Card[];
  activeCardKey?: string;
  upcomingCardKeys?: string[];
  cardIndex?: number;
  totalCards?: number;
  isJapanese?: boolean;
  showKanji?: boolean;
  direction?: StudyDirection;
  ttsAutoplay?: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  canUndo?: boolean;
  enteringFromDirection?: SwipeDirection | null;
  onPrev: () => void;
  onNext: () => void;
  onRate: (rating: ReviewRating, direction?: SwipeDirection) => void;
  onUndo?: () => void;
}

function CardFaceContent({
  card,
  face,
  isJapanese,
  showKanji,
  direction,
  ttsLang,
  spokenTerm,
  t,
}: {
  card: Card;
  face: 'front' | 'back';
  isJapanese: boolean;
  showKanji: boolean;
  direction: StudyDirection;
  ttsLang: string;
  spokenTerm: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (face === 'front') {
    const frontTitle =
      direction === 'meaning_to_term' ? (
        <h2 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
          {card.meaning}
        </h2>
      ) : direction === 'listen_to_term' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('study.listenPrompt')}</p>
          <TtsButton
            text={spokenTerm}
            lang={ttsLang}
            audioUrl={card.audioUrl}
            size="lg"
            label={t('study.listenPlay')}
          />
        </div>
      ) : isJapanese ? (
        <>
          <h2 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
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
          <h2 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{card.term}</h2>
          {card.phonetic && (
            <p className="mt-2 font-mono text-base text-muted-foreground">{card.phonetic}</p>
          )}
        </>
      );

    return (
      <>
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
          <TtsButton text={spokenTerm} lang={ttsLang} audioUrl={card.audioUrl} />
        </div>

        <div className="my-2 flex flex-col items-center justify-center px-1 text-center">
          {frontTitle}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RotateCw className="h-3.5 w-3.5" />
          <span>{t('study.showAnswer')}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-primary">
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
          <p className="break-words text-2xl font-bold text-foreground sm:text-3xl">
            <JapaneseTerm card={card} showKanji={showKanji} />
          </p>
        ) : (
          <p className="break-words text-2xl font-bold text-foreground sm:text-3xl">
            {card.meaning}
          </p>
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
              className={`italic text-foreground ${isJapanese ? 'not-italic font-jp' : ''}`}
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
            {card.verbForms.masu && <Badge variant="outline">ます: {card.verbForms.masu}</Badge>}
            {card.verbForms.te && <Badge variant="outline">て: {card.verbForms.te}</Badge>}
            {card.verbForms.ta && <Badge variant="outline">た: {card.verbForms.ta}</Badge>}
            {card.verbForms.nai && <Badge variant="outline">ない: {card.verbForms.nai}</Badge>}
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
    </>
  );
}

export function FlipCardMode({
  card,
  upcomingCards = [],
  activeCardKey,
  upcomingCardKeys,
  cardIndex = 0,
  totalCards = 1,
  isJapanese = false,
  showKanji = false,
  direction = 'term_to_meaning',
  ttsAutoplay = false,
  canGoPrev,
  canGoNext,
  canUndo = false,
  enteringFromDirection = null,
  onPrev,
  onNext,
  onRate,
  onUndo,
}: FlipCardModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const helpTextId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const commandSeqRef = useRef(0);
  const hadInteractionRef = useRef(false);
  const lastSpokenCardKeyRef = useRef<string | null>(null);

  const [flipped, setFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeCommand, setSwipeCommand] = useState<SwipeCommand | null>(null);
  const [lockedNotice, setLockedNotice] = useState(false);

  const swipeEnabled = settings?.swipeEnabled ?? true;
  const allowSwipeBeforeFlip = settings?.allowSwipeBeforeFlip ?? true;
  const swipeThreshold = settings?.swipeThreshold ?? 100;
  const verticalEnabled = settings?.swipeVerticalEnabled ?? true;
  const hapticsEnabled = settings?.hapticsEnabled ?? true;

  const canRateNow = flipped || (swipeEnabled && allowSwipeBeforeFlip);
  const resolvedActiveKey = activeCardKey || card.id;

  const ttsLang = isJapanese ? 'ja-JP' : settings?.ttsLang || 'en-US';
  const spokenTerm = isJapanese ? getDisplayKana(card) : card.term;

  useEffect(() => {
    setFlipped(false);
    setLockedNotice(false);
    setIsAnimating(false);
    setSwipeCommand(null);
    lastSpokenCardKeyRef.current = null;

    if (hadInteractionRef.current && containerRef.current) {
      const container = containerRef.current;
      requestAnimationFrame(() => {
        const activeGroup = container.querySelector<HTMLElement>(
          '[data-testid="active-swipe-card"] [role="group"]'
        );
        activeGroup?.focus({ preventScroll: true });
      });
    }

    return () => {
      stopSpeaking();
    };
  }, [resolvedActiveKey, card.id]);

  // Auto-read whenever arriving at a card (works for both EN & JA decks)
  useEffect(() => {
    const shouldAutoRead = Boolean(ttsAutoplay || direction === 'listen_to_term');
    if (!shouldAutoRead) return;
    if (lastSpokenCardKeyRef.current === resolvedActiveKey) return;
    lastSpokenCardKeyRef.current = resolvedActiveKey;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedActiveKey, card.id, ttsAutoplay, direction, ttsLang]);

  const toggleFlip = useCallback(() => {
    hadInteractionRef.current = true;
    setLockedNotice(false);
    setFlipped((f) => !f);
  }, []);

  const triggerAnimatedSwipe = useCallback(
    (swipeDir: SwipeDirection) => {
      if (isAnimating) return;
      if (!canRateNow) {
        setLockedNotice(true);
        return;
      }
      hadInteractionRef.current = true;
      commandSeqRef.current += 1;
      setSwipeCommand({ id: commandSeqRef.current, direction: swipeDir });
    },
    [canRateNow, isAnimating]
  );

  const handleRatingButton = useCallback(
    (rating: ReviewRating) => {
      hadInteractionRef.current = true;
      if (!swipeEnabled) {
        onRate(rating);
        return;
      }
      triggerAnimatedSwipe(RATING_TO_DIRECTION[rating]);
    },
    [onRate, swipeEnabled, triggerAnimatedSwipe]
  );

  const handleLockedSwipeAttempt = useCallback(() => {
    setLockedNotice(true);
    setTimeout(() => setLockedNotice(false), 1800);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleFlip();
      } else if (
        canUndo &&
        onUndo &&
        !isAnimating &&
        (e.key.toLowerCase() === 'u' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        hadInteractionRef.current = true;
        onUndo();
      } else if (swipeEnabled) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          triggerAnimatedSwipe('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          triggerAnimatedSwipe('right');
        } else if (e.key === 'ArrowUp' && verticalEnabled) {
          e.preventDefault();
          triggerAnimatedSwipe('up');
        } else if (e.key === 'ArrowDown' && verticalEnabled) {
          e.preventDefault();
          triggerAnimatedSwipe('down');
        } else if (canRateNow && ['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          hadInteractionRef.current = true;
          onRate(Number(e.key) as ReviewRating);
        }
      } else {
        if (e.key === 'ArrowLeft' && canGoPrev) {
          e.preventDefault();
          onPrev();
        } else if (e.key === 'ArrowRight' && canGoNext) {
          e.preventDefault();
          onNext();
        } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          hadInteractionRef.current = true;
          onRate(Number(e.key) as ReviewRating);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canGoNext,
    canGoPrev,
    canRateNow,
    canUndo,
    flipped,
    isAnimating,
    onNext,
    onPrev,
    onRate,
    onUndo,
    swipeEnabled,
    toggleFlip,
    triggerAnimatedSwipe,
    verticalEnabled,
  ]);

  const stackEntries = useMemo(() => {
    const entries: Array<{
      card: Card;
      key: string;
      depth: 0 | 1 | 2;
    }> = [{ card, key: resolvedActiveKey, depth: 0 }];

    const preview = upcomingCards.slice(0, 2);
    preview.forEach((nextCard, i) => {
      const depth = (i + 1) as 1 | 2;
      entries.push({
        card: nextCard,
        key: upcomingCardKeys?.[i] || `${nextCard.id}-stack-${depth}`,
        depth,
      });
    });

    // Render deepest cards first so top card paints highest cleanly
    return entries.reverse();
  }, [card, resolvedActiveKey, upcomingCardKeys, upcomingCards]);

  return (
    <div ref={containerRef} className="mx-auto max-w-2xl space-y-5">
      <p id={helpTextId} className="sr-only">
        {t('study.dragActionHelp')}
      </p>

      {/* Card Stack Viewport (clips horizontal fly-out without causing document scrollbars) */}
      <div className="overflow-x-clip px-2 py-4 sm:px-4">
        <div className="relative mx-auto h-[340px] w-full sm:h-[380px]">
          {stackEntries.map((entry) => {
            const entrySpoken = isJapanese ? getDisplayKana(entry.card) : entry.card.term;
            return (
              <SwipeableCard
                key={entry.key}
                cardId={entry.key}
                stackDepth={entry.depth}
                flipped={entry.depth === 0 ? flipped : false}
                onFlip={toggleFlip}
                swipeEnabled={swipeEnabled}
                allowSwipeBeforeFlip={allowSwipeBeforeFlip}
                threshold={swipeThreshold}
                verticalEnabled={verticalEnabled}
                hapticsEnabled={hapticsEnabled}
                enteringFromDirection={entry.depth === 0 ? enteringFromDirection : null}
                swipeCommand={entry.depth === 0 ? swipeCommand : null}
                onAnimatingChange={entry.depth === 0 ? setIsAnimating : undefined}
                onCommitRating={(rating, swipeDir) => {
                  hadInteractionRef.current = true;
                  onRate(rating, swipeDir);
                }}
                onLockedSwipeAttempt={handleLockedSwipeAttempt}
                ariaLabel={t('study.cardStackAria', {
                  current: cardIndex + 1,
                  total: Math.max(1, totalCards),
                  term: flipped ? `${entrySpoken}: ${entry.card.meaning}` : entrySpoken,
                })}
                ariaDescriptionId={helpTextId}
                frontContent={
                  <CardFaceContent
                    card={entry.card}
                    face="front"
                    isJapanese={isJapanese}
                    showKanji={showKanji}
                    direction={direction}
                    ttsLang={ttsLang}
                    spokenTerm={entrySpoken}
                    t={t}
                  />
                }
                backContent={
                  <CardFaceContent
                    card={entry.card}
                    face="back"
                    isJapanese={isJapanese}
                    showKanji={showKanji}
                    direction={direction}
                    ttsLang={ttsLang}
                    spokenTerm={entrySpoken}
                    t={t}
                  />
                }
              />
            );
          })}
        </div>
      </div>

      {lockedNotice && (
        <p
          role="status"
          className="text-center text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          {t('study.flipFirstToRate')}
        </p>
      )}

      {/* Flip / Previous / Next / Undo Action Row */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!canGoPrev || isAnimating}
          onClick={() => {
            hadInteractionRef.current = true;
            onPrev();
          }}
          aria-label={t('common.previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
          {swipeEnabled && (
            <Button
              variant="outline"
              size="md"
              disabled={!canUndo || isAnimating}
              onClick={() => {
                hadInteractionRef.current = true;
                onUndo?.();
              }}
              title={t('study.undoHint')}
              aria-label={t('study.undoHint')}
              className="shrink-0 px-2.5 sm:px-3"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">{t('study.undo')}</span>
            </Button>
          )}

          <Button size="lg" className="flex-1 max-w-xs" disabled={isAnimating} onClick={toggleFlip}>
            {flipped ? t('study.hideAnswer') : t('study.showAnswer')}
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          disabled={!canGoNext || isAnimating}
          onClick={() => {
            hadInteractionRef.current = true;
            onNext();
          }}
          aria-label={t('common.next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Rating Buttons (always reachable as click fallback, trigger animated swipe when enabled) */}
      {(swipeEnabled || flipped) && (
        <RatingBar
          card={card}
          onRate={handleRatingButton}
          disabled={isAnimating || !canRateNow}
          showDirectionHints={swipeEnabled}
          verticalEnabled={verticalEnabled}
        />
      )}

      {/* Keyboard hints (shown on desktop only) */}
      <p className="hidden text-center text-xs text-muted-foreground sm:block">
        {swipeEnabled ? t('study.swipeKeyHints') : t('study.flipHint')}
      </p>
    </div>
  );
}
