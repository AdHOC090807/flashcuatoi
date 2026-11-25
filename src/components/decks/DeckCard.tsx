import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Edit2, Play, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Deck, DeckCounts } from '@/types';

interface DeckCardProps {
  deck: Deck;
  counts: DeckCounts;
  onEdit: (deck: Deck) => void;
  onDelete: (deck: Deck) => void;
}

export function DeckCard({ deck, counts, onEdit, onDelete }: DeckCardProps) {
  const { t } = useTranslation();
  const readyCount = counts.newCount + counts.learningCount + counts.dueCount;

  return (
    <Card className="group relative flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5 w-full" style={{ backgroundColor: deck.color }} />
      <CardContent className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/decks/${deck.id}`}
              className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${deck.color}20` }}
              >
                {deck.emoji}
              </span>
              <div>
                <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">
                  {deck.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {counts.totalCount} {t('common.cards')}
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(deck)}
                aria-label={`${t('common.edit')} ${deck.name}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(deck)}
                aria-label={`${t('common.delete')} ${deck.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {deck.description && (
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{deck.description}</p>
          )}

          {deck.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {deck.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px]">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-3.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-sky-600 dark:text-sky-400">
              {t('common.new')}: {counts.newCount}
            </span>
            <span className="text-amber-600 dark:text-amber-400">
              {t('common.learning')}: {counts.learningCount}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {t('common.due')}: {counts.dueCount}
            </span>
          </div>

          <div className="flex gap-2">
            <Link to={`/study/${deck.id}?mode=flip`} className="flex-1">
              <Button className="w-full" size="sm" disabled={counts.totalCount === 0}>
                <Play className="h-3.5 w-3.5" />
                <span>
                  {t('dashboard.studyNow')} {readyCount > 0 ? `(${readyCount})` : ''}
                </span>
              </Button>
            </Link>
            <Link to={`/decks/${deck.id}`}>
              <Button variant="outline" size="sm">
                {t('common.edit')}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
