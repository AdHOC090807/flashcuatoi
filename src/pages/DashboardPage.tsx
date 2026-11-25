import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Award, Flame, Headphones, Keyboard, Layers, Play, Sparkles, Trophy } from 'lucide-react';
import { db } from '@/db';
import { BADGE_DEFINITIONS, calculateStreak } from '@/features/gamification';
import { getDeckCounts } from '@/features/srs/sm2';
import { startOfDayMs } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { GoalRing } from '@/components/onboarding/GoalRing';

export function DashboardPage() {
  const { t } = useTranslation();
  const decks = useLiveQuery(() => db.decks.orderBy('updatedAt').reverse().toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const logs = useLiveQuery(() => db.reviewLogs.toArray());
  const settings = useLiveQuery(() => db.settings.get('default'));

  const stats = useMemo(() => {
    if (!cards || !logs || !settings) return null;
    const now = Date.now();
    const todayStart = startOfDayMs(now);
    const todaysLogs = logs.filter((l) => l.reviewedAt >= todayStart);
    const uniqueReviewedToday = new Set(todaysLogs.map((l) => l.cardId)).size;
    const newStudiedToday = new Set(
      todaysLogs.filter((l) => l.previousInterval === 0).map((l) => l.cardId)
    ).size;

    const totalCounts = getDeckCounts(cards, newStudiedToday, settings.dailyNewLimit, now);
    const streak = calculateStreak(logs, now);
    const totalDue = totalCounts.newCount + totalCounts.learningCount + totalCounts.dueCount;

    return {
      uniqueReviewedToday,
      newStudiedToday,
      totalCounts,
      totalDue,
      streak,
    };
  }, [cards, logs, settings]);

  if (!decks || !cards || !logs || !settings || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  const firstDeckId = decks[0]?.id ?? 'all';
  const quickModes = [
    { mode: 'flip', label: t('study.modes.flip'), icon: Layers },
    { mode: 'quiz', label: t('study.modes.quiz'), icon: Sparkles },
    { mode: 'typing', label: t('study.modes.typing'), icon: Keyboard },
    { mode: 'listen', label: t('study.modes.listen'), icon: Headphones },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('dashboard.welcome')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/study/all?mode=flip">
            <Button size="lg" disabled={cards.length === 0}>
              <Play className="h-4 w-4" />
              <span>
                {t('dashboard.studyAllDue')} ({stats.totalDue})
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('dashboard.dueToday')}</p>
              <p className="mt-1 text-3xl font-bold">{stats.totalDue}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.totalCounts.newCount} {t('common.new')} • {stats.totalCounts.learningCount}{' '}
                {t('common.learning')} • {stats.totalCounts.dueCount} {t('common.due')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t('dashboard.dailyGoal')}
              </p>
              <p className="mt-1 text-xl font-bold">
                {stats.uniqueReviewedToday} / {settings.dailyGoal}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('dashboard.cardsProgress', {
                  done: stats.uniqueReviewedToday,
                  goal: settings.dailyGoal,
                })}
              </p>
            </div>
            <GoalRing current={stats.uniqueReviewedToday} goal={settings.dailyGoal} size={74} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('dashboard.streak')}</p>
              <p className="mt-1 text-3xl font-bold">{stats.streak}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('stats.streak')}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Flame className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('dashboard.totalXp')}</p>
              <p className="mt-1 text-3xl font-bold">{settings.xp}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {settings.unlockedBadges.length} / {BADGE_DEFINITIONS.length}{' '}
                {t('dashboard.recentBadges')}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Trophy className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start + Badges */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.quickStart')}</CardTitle>
            <Link to="/decks" className="text-sm font-medium text-primary hover:underline">
              {t('dashboard.viewAllDecks')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickModes.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.mode}
                    to={`/study/${firstDeckId}?mode=${item.mode}`}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition hover:border-primary hover:bg-accent/50"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('dashboard.yourDecks')}
              </h4>
              {decks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {decks.slice(0, 4).map((deck) => {
                    const deckCards = cards.filter((c) => c.deckId === deck.id);
                    const c = getDeckCounts(
                      deckCards,
                      stats.newStudiedToday,
                      settings.dailyNewLimit
                    );
                    const ready = c.newCount + c.learningCount + c.dueCount;
                    return (
                      <Link
                        key={deck.id}
                        to={`/decks/${deck.id}`}
                        className="flex items-center justify-between rounded-xl border border-border p-3.5 transition hover:border-primary/60 hover:bg-accent/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl">{deck.emoji}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-sm">{deck.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.totalCount} {t('common.cards')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={ready > 0 ? 'default' : 'secondary'}>
                          {ready} {t('common.due')}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <span>{t('dashboard.recentBadges')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {BADGE_DEFINITIONS.map((badge) => {
              const unlocked = settings.unlockedBadges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm ${
                    unlocked ? 'border-amber-500/40 bg-amber-500/10' : 'opacity-50'
                  }`}
                >
                  <span className="text-xl">{badge.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-xs">{t(badge.titleKey)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t(badge.descriptionKey)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
