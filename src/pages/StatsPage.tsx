import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '@/db';
import { calculateStreak } from '@/features/gamification';
import { DAY_MS } from '@/features/srs/sm2';
import { formatDateKey, startOfDayMs } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export function StatsPage() {
  const { t } = useTranslation();
  const decks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const logs = useLiveQuery(() => db.reviewLogs.toArray());

  const analytics = useMemo(() => {
    if (!decks || !cards || !logs) return null;
    const now = Date.now();
    const todayStart = startOfDayMs(now);

    const totalReviews = logs.length;
    const correctCount = logs.filter((l) => l.correct).length;
    const accuracy = totalReviews > 0 ? Math.round((correctCount / totalReviews) * 100) : 0;
    const streak = calculateStreak(logs, now);
    const masteredCount = cards.filter((c) => c.interval >= 21).length;

    // 14-day daily activity
    const logsByDay = new Map<string, number>();
    logs.forEach((l) => {
      const key = formatDateKey(l.reviewedAt);
      logsByDay.set(key, (logsByDay.get(key) ?? 0) + 1);
    });

    const dailyData = Array.from({ length: 14 }, (_, idx) => {
      const dayMs = todayStart - (13 - idx) * DAY_MS;
      const key = formatDateKey(dayMs);
      return {
        date: key.slice(5),
        count: logsByDay.get(key) ?? 0,
      };
    });

    // 12-week heatmap (84 days)
    const heatmapDays = Array.from({ length: 84 }, (_, idx) => {
      const dayMs = todayStart - (83 - idx) * DAY_MS;
      const key = formatDateKey(dayMs);
      return {
        key,
        count: logsByDay.get(key) ?? 0,
      };
    });

    // Retention curve by interval bucket
    const buckets = [
      { label: '0d (New)', min: 0, max: 0 },
      { label: '1-3d', min: 1, max: 3 },
      { label: '4-7d', min: 4, max: 7 },
      { label: '8-21d', min: 8, max: 21 },
      { label: '22d+', min: 22, max: Infinity },
    ];
    const retentionData = buckets.map((b) => {
      const matching = logs.filter(
        (l) => l.previousInterval >= b.min && l.previousInterval <= b.max
      );
      const rate =
        matching.length > 0
          ? Math.round((matching.filter((l) => l.correct).length / matching.length) * 100)
          : 0;
      return {
        bucket: b.label,
        retention: rate,
        reviews: matching.length,
      };
    });

    // Hardest cards (lapses > 0 or lowest easeFactor among reviewed)
    const hardestCards = [...cards]
      .filter((c) => c.lapses > 0 || c.lastReviewedAt !== null)
      .sort((a, b) => b.lapses - a.lapses || a.easeFactor - b.easeFactor)
      .slice(0, 8);

    // Per-deck progress
    const deckProgress = decks.map((d) => {
      const deckCards = cards.filter((c) => c.deckId === d.id);
      const learned = deckCards.filter((c) => c.status !== 'new').length;
      const mastered = deckCards.filter((c) => c.interval >= 21).length;
      const pct = deckCards.length > 0 ? Math.round((learned / deckCards.length) * 100) : 0;
      return {
        deck: d,
        total: deckCards.length,
        learned,
        mastered,
        pct,
      };
    });

    return {
      totalReviews,
      accuracy,
      streak,
      masteredCount,
      dailyData,
      heatmapDays,
      retentionData,
      hardestCards,
      deckProgress,
    };
  }, [decks, cards, logs]);

  if (!analytics) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('stats.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('stats.subtitle')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t('stats.totalReviews')}</p>
            <p className="mt-1 text-3xl font-bold">{analytics.totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t('stats.accuracy')}</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {analytics.accuracy}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t('stats.streak')}</p>
            <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">
              {analytics.streak}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t('stats.masteredCards')}</p>
            <p className="mt-1 text-3xl font-bold text-primary">{analytics.masteredCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.dailyActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('stats.retentionCurve')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.retentionData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="bucket" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="retention"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 12-week Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>{t('stats.heatmap')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1.5 sm:grid-cols-[repeat(21,minmax(0,1fr))]">
            {analytics.heatmapDays.map((day) => {
              const level =
                day.count === 0
                  ? 'bg-muted'
                  : day.count < 5
                    ? 'bg-emerald-300 dark:bg-emerald-900'
                    : day.count < 15
                      ? 'bg-emerald-500 dark:bg-emerald-700'
                      : 'bg-emerald-700 dark:bg-emerald-500';
              return (
                <div
                  key={day.key}
                  title={`${day.key}: ${day.count}`}
                  className={`aspect-square rounded-sm ${level}`}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Deck Progress + Hardest Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.deckProgress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.deckProgress.map(({ deck, total, learned, mastered, pct }) => (
              <div key={deck.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {deck.emoji} {deck.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {learned}/{total} ({mastered} {t('common.mastered')})
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: deck.color }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('stats.hardestCards')}</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.hardestCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('stats.noData')}</p>
            ) : (
              <div className="space-y-2.5">
                {analytics.hardestCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-semibold">{card.term}</p>
                      <p className="truncate text-xs text-muted-foreground">{card.meaning}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="danger">
                        {card.lapses} {t('stats.lapses')}
                      </Badge>
                      <Badge variant="outline">
                        {t('stats.ease')}: {card.easeFactor.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
