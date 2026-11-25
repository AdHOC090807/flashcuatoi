import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Gamepad2, Headphones, Keyboard, Layers, Sparkles } from 'lucide-react';
import { db } from '@/db';
import { recordCardReview } from '@/db/actions';
import { buildStudyQueue } from '@/features/srs/sm2';
import { startOfDayMs, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { FlipCardMode } from '@/components/study/FlipCardMode';
import { QuizMode } from '@/components/study/QuizMode';
import { TypingMode } from '@/components/study/TypingMode';
import { MatchingMode } from '@/components/study/MatchingMode';
import { ListeningMode } from '@/components/study/ListeningMode';
import { SessionSummary } from '@/components/study/SessionSummary';
import type { Card, ReviewRating, StudyMode } from '@/types';

const VALID_MODES: StudyMode[] = ['flip', 'quiz', 'typing', 'match', 'listen'];

export function StudyPage() {
  const { deckId = 'all' } = useParams<{ deckId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const rawMode = searchParams.get('mode') as StudyMode | null;
  const mode: StudyMode = rawMode && VALID_MODES.includes(rawMode) ? rawMode : 'flip';

  const deck = useLiveQuery(
    async () => (deckId === 'all' ? undefined : db.decks.get(deckId)),
    [deckId]
  );
  const deckCards = useLiveQuery(
    () =>
      deckId === 'all' ? db.cards.toArray() : db.cards.where('deckId').equals(deckId).toArray(),
    [deckId]
  );
  const settings = useLiveQuery(() => db.settings.get('default'));

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
  const cardShownAtRef = useRef<number>(Date.now());

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
      forceAll
    );
    setSessionQueue(queue);
    setCurrentIndex(0);
    setCompleted(false);
    setSessionStats({ reviewed: 0, correct: 0, xp: 0, badges: [] });
    cardShownAtRef.current = Date.now();
  };

  useEffect(() => {
    if (deckCards && settings && sessionQueue === null) {
      void initQueue(practiceAll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckCards, settings, sessionQueue]);

  const handleModeChange = (nextMode: StudyMode) => {
    setSearchParams({ mode: nextMode });
    setSessionQueue(null);
  };

  const handleRateOrAnswer = async (rating: ReviewRating, isCorrect?: boolean) => {
    if (!sessionQueue) return;
    const card = sessionQueue[currentIndex];
    if (!card) return;

    const elapsedMs = Date.now() - cardShownAtRef.current;
    const result = await recordCardReview(card, rating, mode, elapsedMs);
    const correct = isCorrect !== undefined ? isCorrect : rating >= 2;

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct + (correct ? 1 : 0),
      xp: prev.xp + result.xpEarned,
      badges: Array.from(new Set([...prev.badges, ...result.newlyUnlockedBadges])),
    }));

    // In Flip mode, re-queue "Again" cards once at the end of the session
    let nextQueue = sessionQueue;
    if (mode === 'flip' && rating === 1 && sessionQueue.length < 40) {
      nextQueue = [...sessionQueue, result.updatedCard];
      setSessionQueue(nextQueue);
    }

    if (currentIndex + 1 >= nextQueue.length) {
      setCompleted(true);
    } else {
      setCurrentIndex((i) => i + 1);
      cardShownAtRef.current = Date.now();
    }
  };

  const modeTabs = useMemo(
    () => [
      { id: 'flip' as const, label: t('study.modes.flip'), icon: Layers },
      { id: 'quiz' as const, label: t('study.modes.quiz'), icon: Sparkles },
      { id: 'typing' as const, label: t('study.modes.typing'), icon: Keyboard },
      { id: 'match' as const, label: t('study.modes.match'), icon: Gamepad2 },
      { id: 'listen' as const, label: t('study.modes.listen'), icon: Headphones },
    ],
    [t]
  );

  if (!deckCards || !settings || sessionQueue === null) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const currentCard = sessionQueue[currentIndex];
  const progressPct =
    sessionQueue.length > 0
      ? Math.round(((completed ? sessionQueue.length : currentIndex) / sessionQueue.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Link to={deckId === 'all' ? '/decks' : `/decks/${deckId}`}>
            <Button variant="ghost" size="icon" aria-label={t('common.back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">
              {deck ? `${deck.emoji} ${deck.name}` : t('dashboard.studyAllDue')}
            </h1>
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

      {/* Progress Bar */}
      {sessionQueue.length > 0 && mode !== 'match' && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
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
          canGoPrev={currentIndex > 0}
          canGoNext={currentIndex + 1 < sessionQueue.length}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCurrentIndex((i) => Math.min(sessionQueue.length - 1, i + 1))}
          onRate={(r) => void handleRateOrAnswer(r)}
        />
      ) : mode === 'quiz' && currentCard ? (
        <QuizMode
          card={currentCard}
          deckCards={deckCards}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : mode === 'typing' && currentCard ? (
        <TypingMode card={currentCard} onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)} />
      ) : mode === 'listen' && currentCard ? (
        <ListeningMode
          card={currentCard}
          deckCards={deckCards}
          onAnswered={(r, ok) => void handleRateOrAnswer(r, ok)}
        />
      ) : null}
    </div>
  );
}
