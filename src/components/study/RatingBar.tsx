import { useTranslation } from 'react-i18next';
import { previewIntervalLabels } from '@/features/srs/sm2';
import type { Card, ReviewRating } from '@/types';
import { cn } from '@/lib/utils';

interface RatingBarProps {
  card: Card;
  onRate: (rating: ReviewRating) => void;
  disabled?: boolean;
}

const RATING_CONFIG: Array<{
  rating: ReviewRating;
  style: string;
}> = [
  {
    rating: 1,
    style:
      'border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300',
  },
  {
    rating: 2,
    style:
      'border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300',
  },
  {
    rating: 3,
    style:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
  },
  {
    rating: 4,
    style: 'border-sky-500/40 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300',
  },
];

export function RatingBar({ card, onRate, disabled }: RatingBarProps) {
  const { t } = useTranslation();
  const labels = previewIntervalLabels(card);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {RATING_CONFIG.map(({ rating, style }) => (
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
            <kbd className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] font-bold">
              {rating}
            </kbd>
            <span>{t(`study.ratings.${rating}`)}</span>
          </span>
          <span className="mt-0.5 text-xs font-normal opacity-80">{labels[rating]}</span>
        </button>
      ))}
    </div>
  );
}
