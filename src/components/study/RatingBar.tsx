import { useTranslation } from 'react-i18next';
import { previewIntervalLabels } from '@/features/srs/sm2';
import type { Card, ReviewRating } from '@/types';
import { cn } from '@/lib/utils';

interface RatingBarProps {
  card: Card;
  onRate: (rating: ReviewRating) => void;
  disabled?: boolean;
  showDirectionHints?: boolean;
  verticalEnabled?: boolean;
}

const RATING_CONFIG: Array<{
  rating: ReviewRating;
  arrowHint: string;
  style: string;
}> = [
  {
    rating: 1,
    arrowHint: '←',
    style:
      'border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300',
  },
  {
    rating: 2,
    arrowHint: '↓',
    style:
      'border-orange-500/40 bg-orange-500/10 text-orange-800 hover:bg-orange-500/20 dark:text-orange-300',
  },
  {
    rating: 3,
    arrowHint: '→',
    style:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
  },
  {
    rating: 4,
    arrowHint: '↑',
    style: 'border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300',
  },
];

export function RatingBar({
  card,
  onRate,
  disabled,
  showDirectionHints = false,
  verticalEnabled = true,
}: RatingBarProps) {
  const { t } = useTranslation();
  const labels = previewIntervalLabels(card);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {RATING_CONFIG.map(({ rating, arrowHint, style }) => {
        const showArrow = showDirectionHints && (rating === 1 || rating === 3 || verticalEnabled);
        return (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onRate(rating)}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
              style
            )}
          >
            <span className="flex items-center gap-1.5">
              <kbd className="hidden rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-bold sm:inline">
                {rating}
              </kbd>
              <span>{t(`study.ratings.${rating}`)}</span>
              {showArrow && (
                <kbd
                  aria-hidden="true"
                  className="hidden rounded bg-background/60 px-1 py-0.5 text-[10px] font-medium opacity-75 sm:inline"
                >
                  {arrowHint}
                </kbd>
              )}
            </span>
            <span className="mt-0.5 text-xs font-normal opacity-80">{labels[rating]}</span>
          </button>
        );
      })}
    </div>
  );
}
