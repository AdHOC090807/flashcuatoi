import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Gamepad2,
  Headphones,
  Keyboard,
  Layers,
  Repeat2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { db } from '@/db';
import { recordCardReview, undoCardReview, updateSettings } from '@/db/actions';
import { buildStudyQueue } from '@/features/srs/sm2';
import { RATING_TO_DIRECTION, type SwipeDirection } from '@/features/study/swipeDecision';
import { startOfDayMs, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { FlipCardMode } from '@/components/study/FlipCardMode';
import { QuizMode } from '@/components/study/QuizMode';
import { TypingMode } from '@/components/study/TypingMode';
import { MatchingMode } from '@/components/study/MatchingMode';
import { ListeningMode } from '@/components/study/ListeningMode';
import { ConjugationDrillMode } from '@/components/study/ConjugationDrillMode';
import { SessionSummary } from '@/components/study/SessionSummary';
import type { Card, ReviewRating, StudyDirection, StudyMode } from '@/types';

const VALID_MODES: StudyMode[] = ['flip', 'quiz', 'typing', 'match', 'listen', 'conjugation'];
const MAX_UNDO_HISTORY = 20;

interface SessionUndoEntry {
  previousCard: Card;
  previousIndex: number;
  previousQueue: Card[];
  previousStats: {
    reviewed: number;
    correct: number;
    xp: number;
    badges: string[];
  };
  reviewLogId: string;
  xpEarned: number;
  lastSwipeDirection: SwipeDirection;
}

export function StudyPage() {
  const { deckId = 'all' } = useParams<{ deckId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const rawMode = searchParams.get('mode') as StudyMode | null;
  const mode: StudyMode = rawMode && VALID_MODES.includes(rawMode) ? rawMode : 'flip';
  const lessonFrom = searchParams.get('lessonFrom') ? Number(searchParams.get('lessonFrom')) : null;
  const lessonTo = searchParams.get('lessonTo') ? Number(searchParams.get('lessonTo')) : null;

  const deck = useLiveQuery(
    async () => (deckId === 'all' ? undefined : db.decks.get(deckId)),
    [deckId]
  );
  const rawCards = useLiveQuery(
    () =>
      deckId === 'all' ? db.cards.toArray() : db.cards.where('deckId').equals(deckId).toArray(),
    [deckId]
  );
  const settings = useLiveQuery(() => db.settings.get('default'));

  const isJapanese = deck?.language === 'ja';
  const showKanji = Boolean(settings?.showKanji);
  const ttsAutoplay = Boolean(settings?.ttsAutoplay);

  const [direction, setDirection] = useState<StudyDirection>('term_to_meaning');
  const [sessionQueue, setSessionQueue] = useState<Card[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceAll, setPracticeAll] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    correct: 0,
    xp: 0,
    badges: [] as string[],
  });
  const [completed, setCompleted] = useState(false);
  const [undoStack, setUndoStack] = useState<SessionUndoEntry[]>([]);
  const [enteringFromDirection, setEnteringFromDirection] = useState<SwipeDirection | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const undoBusyRef = useRef(false);
  const cardShownAtRef = useRef<number>(Date.now());

  const deckCards = useMemo(() => {
    if (!rawCards) return undefined;
    let list = rawCards;
    if (lessonFrom !== null && lessonTo !== null) {
      const minL = Math.min(lessonFrom, lessonTo);
      const maxL = Math.max(lessonFrom, lessonTo);
      list = list.filter(
        (c) => typeof c.lesson === 'number' && c.lesson >= minL && c.lesson <= maxL
      );
    }
    if (mode === 'conjugation') {
      list = list.filter(
        (c) =>
          c.verbForms && (c.verbForms.masu || c.verbForms.te || c.verbForms.ta || c.verbForms.nai)
      );
    }
    return list;
  }, [rawCards, lessonFrom, lessonTo, mode]);

  const hasConjugationCards = useMemo(() => {
    if (!rawCards) return false;
    return rawCards.some(
      (c) =>
        c.verbForms && (c.verbForms.masu || c.verbForms.te || c.verbForms.ta || c.verbForms.nai)
    );
  }, [rawCards]);

  const initQueue = async (forceAll: boolean) => {
    if (!deckCards || !settings) return;
    const todayStart = startOfDayMs();
    const todaysLogs = await db.reviewLogs.where('reviewedAt').aboveOrEqual(todayStart).toArray();
    const newStudiedToday = new Set(
      todaysLogs.filter((l) => l.previousInterval === 0).map((l) => l.cardId)
    ).size;

    const queue = buildStudyQueue(
      deckCards,
      newStudiedToday,
      settings.dailyNewLimit,
      Date.now(),
      forceAll || mode === 'conjugation' || (lessonFrom !== null && lessonTo !== null)
    );
    setSessionQueue(queue);
    setCurrentIndex(0);
    setCompleted(false);
    setUndoStack([]);
    setEnteringFromDirection(null);
    setLiveAnnouncement('');
    setSessionStats({ reviewed: 0, correct: 0, xp: 0, badges: [] });
    cardShownAtRef.current = Date.now();
  };

  useEffect(() => {
    if (deckCards && settings && sessionQueue === null) {
      void initQueue(practiceAll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckCards, settings, sessionQueue]);

  useEffect(() => {
    if (isJapanese && mode === 'typing') {
      setDirection('meaning_to_term');
    } else if (isJapanese && mode !== 'typing') {
      setDirection('term_to_meaning');
    }
  }, [isJapanese, mode]);

  const handleModeChange = (nextMode: StudyMode) => {
    const nextParams: Record<string, string> = { mode: nextMode };
    if (lessonFrom !== null) nextParams.lessonFrom = String(lessonFrom);
    if (lessonTo !== null) nextParams.lessonTo = String(lessonTo);
    setSearchParams(nextParams);
    setSessionQueue(null);
    setUndoStack([]);
    setEnteringFromDirection(null);
  };

  const handleUndo = async () => {
    if (undoBusyRef.current || undoStack.length === 0) return;
    undoBusyRef.current = true;

    try {
      const entry = undoStack[undoStack.length - 1];
      await undoCardReview({
        previousCard: entry.previousCard,
        reviewLogId: entry.reviewLogId,
        xpEarned: entry.xpEarned,
      });

      setUndoStack((prev) => prev.slice(0, -1));
      setSessionQueue(entry.previousQueue);
      setCurrentIndex(entry.previousIndex);
      setSessionStats(entry.previousStats);
      setCompleted(false);
      setEnteringFromDirection(entry.lastSwipeDirection);
      cardShownAtRef.current = Date.now();

      const remainingAfterUndo = Math.max(0, entry.previousQueue.length - entry.previousIndex);
      setLiveAnnouncement(t('study.undoAnnouncement', { remaining: remainingAfterUndo }));
    } finally {
      undoBusyRef.current = false;
    }
  };

  const handleRateOrAnswer = async (
    rating: ReviewRating,
    isCorrect?: boolean,
    swipeDir?: SwipeDirection
  ) => {
    if (!sessionQueue) return;
    const card = sessionQueue[currentIndex];
    if (!card) return;

    const prevStatsSnapshot = { ...sessionStats, badges: [...sessionStats.badges] };
    const prevQueueSnapshot = [...sessionQueue];
    const elapsedMs = Date.now() - cardShownAtRef.current;
    const result = await recordCardReview(card, rating, mode, elapsedMs);
    const correct = isCorrect !== undefined ? isCorrect : rating >= 2;

    if (mode === 'flip') {
      const entry: SessionUndoEntry = {
        previousCard: card,
        previousIndex: currentIndex,
        previousQueue: prevQueueSnapshot,
        previousStats: prevStatsSnapshot,
        reviewLogId: result.reviewLogId,
        xpEarned: result.xpEarned,
        lastSwipeDirection: swipeDir ?? RATING_TO_DIRECTION[rating],
      };
      setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_HISTORY - 1)), entry]);
      setEnteringFromDirection(null);
    }

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (correct ? 1 : 0),
      xp: prev.xp + result.xpEarned,
      badges: Array.from(new Set([...prev.badges, ...result.newlyUnlockedBadges])),
    }));

    let nextQueue = sessionQueue;
    if (mode === 'flip' && rating === 1 && sessionQueue.length < 40) {
      nextQueue = [...sessionQueue, result.updatedCard];
      setSessionQueue(nextQueue);
    }

    const nextIndex = currentIndex + 1;
    const remaining = Math.max(0, nextQueue.length - nextIndex);
    setLiveAnnouncement(
      t('study.ratedAnnouncement', {
        rating: t(`study.ratings.${rating}`),
        remaining,
      })
    );

    if (nextIndex >= nextQueue.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(nextIndex);
      cardShownAtRef.current = Date.now();
    }
  };

  const modeTabs = useMemo(() => {
    const base: Array<{ id: StudyMode; label: string; icon: typeof Layers }> = [
      { id: 'flip', label: t('study.modes.flip'), icon: Layers },
      { id: 'quiz', label: t('study.modes.quiz'), icon: Sparkles },
      { id: 'typing', label: t('study.modes.typing'), icon: Keyboard },
      { id: 'match', label: t('study.modes.match'), icon: Gamepad2 },
      { id: 'listen', label: t('study.modes.listen'), icon: Headphones },
    ];
    if (isJapanese && hasConjugationCards) {
      base.push({ id: 'conjugation', label: t('japanese.conjugationDrill'), icon: Repeat2 });
    }
    return base;
  }, [t, isJapanese, hasConjugationCards]);

  const stackKeys = useMemo(() => {
    if (!sessionQueue) return [];
    const seen = new Map<string, number>();
    return sessionQueue.map((c) => {
      const count = seen.get(c.id) ?? 0;
      seen.set(c.id, count + 1);
      return `${c.id}#${count}`;
    });
  }, [sessionQueue]);

  useEffect(() => {
    if (!completed || mode !== 'flip' || undoStack.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (
        e.key.toLowerCase() === 'u' ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, mode, undoStack.length]);

  if (!deckCards || !settings || sessionQueue === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const currentCard = sessionQueue[currentIndex];
  const remainingCards = completed ? 0 : Math.max(0, sessionQueue.length - currentIndex);
  const progressPct =
    sessionQueue.length > 0
      ? Math.round(((completed ? sessionQueue.length : currentIndex) / sessionQueue.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>
      {/* Header & Mode Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Link to={deckId === 'all' ? '/decks' : `/decks/${deckId}`}>
            <Button variant="ghost" size="icon" aria-label={t('common.back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">
                {deck ? `${deck.emoji} ${deck.name}` : t('dashboard.studyAllDue')}
              </h1>
              {lessonFrom !== null && lessonTo !== null && (
                <Badge variant="secondary">
                  {t('japanese.lessonRangeBadge', { from: lessonFrom, to: lessonTo })}
                </Badge>
              )}
            </div>
            {sessionQueue.length > 0 && !completed && mode !== 'match' && (
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} / {sessionQueue.length}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Study modes">
          {modeTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={mode === tab.id}
                onClick={() => handleModeChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  mode === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Japanese study direction & autoplay controls */}
      {isJapanese && ['flip', 'quiz', 'typing'].includes(mode) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-muted-foreground">{t('japanese.direction')}:</span>
            {(
              [
                { id: 'term_to_meaning', label: t('japanese.dirKanaToVi') },
                { id: 'meaning_to_term', label: t('japanese.dirViToKana') },
                { id: 'listen_to_term', label: t('japanese.dirListenToKana') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDirection(opt.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition',
                  direction === opt.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant={ttsAutoplay ? 'default' : 'outline'}
            onClick={() => void updateSettings({ ttsAutoplay: !ttsAutoplay })}
            className="h-7 px-2.5 text-xs"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>{t('japanese.autoplay')}</span>
          </Button>
        </div>
      )}

      {/* Progress Bar & Counters */}
      {sessionQueue.length > 0 && mode !== 'match' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('study.doneCount', { count: sessionStats.reviewed })}</span>
            <span>{t('study.remainingCount', { count: remainingCards })}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Study Content */}
      {completed ? (
        <SessionSummary
          deckId={deckId}
          reviewedCount={sessionStats.reviewed}
          accuracyPct={
            sessionStats.reviewed > 0
              ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100)
              : 100
          }
          xpEarned={sessionStats.xp}
          unlockedBadgeIds={sessionStats.badges}
          canUndoLast={mode === 'flip' && undoStack.length > 0}
          onUndoLast={() => void handleUndo()}
          onRestart={() => {
            setPracticeAll(true);
            void initQueue(true);
          }}
        />
      ) : sessionQueue.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold">{t('study.noCardsDue')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('study.noCardsDueDesc')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to={deckId === 'all' ? '/decks' : `/decks/${deckId}`}>
              <Button variant="outline">{t('study.backToDeck')}</Button>
            </Link>
            {deckCards.length > 0 && (
              <Button
                onClick={() => {
                  setPracticeAll(true);
                  void initQueue(true);
                }}
              >
                {t('study.practiceAll')}
              </Button>
            )}
          </div>
        </div>
      ) : mode === 'match' ? (
        <MatchingMode
          cards={sessionQueue}
          isJapanese={isJapanese}
          showKanji={showKanji}
          onPairMatched={async (matchedCard, rating) => {
            const res = await recordCardReview(matchedCard, rating, 'match', 1500);
            setSessionStats((prev) => ({
              reviewed: prev.reviewed + 1,
              correct: prev.correct + 1,
              xp: prev.xp + res.xpEarned,
              badges: Array.from(new Set([...prev.badges, ...res.newlyUnlockedBadges])),
            }));
          }}
          onComplete={() => setCompleted(true)}
        />
      ) : mode === 'flip' && currentCard ? (
        <FlipCardMode
          card={currentCard}
          upcomingCards={sessionQueue.slice(currentIndex + 1, currentIndex + 3)}
          activeCardKey={stackKeys[currentIndex]}
          upcomingCardKeys={stackKeys.slice(currentIndex + 1, currentIndex + 3)}
          cardIndex={currentIndex}
          totalCards={sessionQueue.length}
          isJapanese={isJapanese}
          showKanji={showKanji}
          direction={direction}
          ttsAutoplay={ttsAutoplay}
          canGoPrev={currentIndex > 0}
          canGoNext={currentIndex + 1 < sessionQueue.length}
          canUndo={undoStack.length > 0}
          enteringFromDirection={enteringFromDirection}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(sessionQueue.length - 1, i + 1))}
          onRate={(r, dir) => void handleRateOrAnswer(r, undefined, dir)}
          onUndo={() => void handleUndo()}
        />
      ) : mode === 'quiz' && currentCard ? (
        <QuizMode
          card={currentCard}
          deckCards={rawCards ?? deckCards}
          isJapanese={isJapanese}
          showKanji={showKanji}
          direction={direction}
          ttsAutoplay={ttsAutoplay}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : mode === 'typing' && currentCard ? (
        <TypingMode
          card={currentCard}
          isJapanese={isJapanese}
          showKanji={showKanji}
          direction={direction}
          ttsAutoplay={ttsAutoplay}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : mode === 'listen' && currentCard ? (
        <ListeningMode
          card={currentCard}
          deckCards={rawCards ?? deckCards}
          isJapanese={isJapanese}
          showKanji={showKanji}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : mode === 'conjugation' && currentCard ? (
        <ConjugationDrillMode
          card={currentCard}
          showKanji={showKanji}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : null}
    </div>
  );
}
