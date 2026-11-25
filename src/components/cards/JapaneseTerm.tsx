import { getDisplayKana } from '@/features/japanese';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';

interface JapaneseTermProps {
  card: Pick<Card, 'term' | 'kana' | 'kanji'>;
  showKanji?: boolean;
  className?: string;
}

export function JapaneseTerm({ card, showKanji = false, className }: JapaneseTermProps) {
  const kana = getDisplayKana(card);

  if (showKanji && card.kanji?.trim()) {
    return (
      <ruby lang="ja" className={cn('font-jp', className)}>
        {card.kanji.trim()}
        <rp>(</rp>
        <rt className="text-[0.52em] font-normal text-muted-foreground">{kana}</rt>
        <rp>)</rp>
      </ruby>
    );
  }

  return (
    <span lang="ja" className={cn('font-jp', className)}>
      {kana}
    </span>
  );
}
