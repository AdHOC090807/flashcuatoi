import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, CheckCircle2, RotateCcw } from 'lucide-react';
import { BADGE_DEFINITIONS } from '@/features/gamification';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface SessionSummaryProps {
  deckId: string;
  reviewedCount: number;
  accuracyPct: number;
  xpEarned: number;
  unlockedBadgeIds: string[];
  canUndoLast?: boolean;
  onUndoLast?: () => void;
  onRestart: () => void;
}

export function SessionSummary({
  deckId,
  reviewedCount,
  accuracyPct,
  xpEarned,
  unlockedBadgeIds,
  canUndoLast = false,
  onUndoLast,
  onRestart,
}: SessionSummaryProps) {
  const { t } = useTranslation();
  const unlockedBadges = BADGE_DEFINITIONS.filter((b) => unlockedBadgeIds.includes(b.id));

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardContent className="space-y-6 p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <div>
          <h2 className="text-2xl font-bold">{t('study.sessionComplete')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('study.sessionCompleteDesc')}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-4">
          <div>
            <p className="text-2xl font-bold">{reviewedCount}</p>
            <p className="text-xs text-muted-foreground">{t('study.reviewedCount')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {accuracyPct}%
            </p>
            <p className="text-xs text-muted-foreground">{t('study.accuracy')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">+{xpEarned}</p>
            <p className="text-xs text-muted-foreground">{t('study.xpEarned')}</p>
          </div>
        </div>

        {unlockedBadges.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Award className="h-4 w-4" />
              <span>{t('dashboard.recentBadges')}</span>
            </p>
            <div className="mt-2 space-y-1.5">
              {unlockedBadges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{b.icon}</span>
                  <span className="font-semibold">{t(b.titleKey)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {canUndoLast && onUndoLast && (
            <Button variant="outline" className="flex-1" onClick={onUndoLast}>
              <RotateCcw className="h-4 w-4" />
              <span>{t('study.undoLast')}</span>
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            <span>{t('study.practiceAgain')}</span>
          </Button>
          <Link to={deckId === 'all' ? '/decks' : `/decks/${deckId}`} className="flex-1">
            <Button className="w-full">{t('study.backToDeck')}</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
