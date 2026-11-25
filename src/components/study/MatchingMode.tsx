import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import type { Card, ReviewRating } from '@/types';
import { cn } from '@/lib/utils';

interface MatchTile {
  uid: string;
  cardId: string;
  side: 'term' | 'meaning';
  card: Card;
}

interface MatchingModeProps {
  cards: Card[];
  isJapanese?: boolean;
  showKanji?: boolean;
  onPairMatched: (card: Card, rating: ReviewRating) => void;
  onComplete: (accuracyPct: number) => void;
}

export function MatchingMode({
  cards,
  isJapanese = false,
  showKanji = false,
  onPairMatched,
  onComplete,
}: MatchingModeProps) {
  const { t } = useTranslation();
  const roundCards = useMemo(() => cards.slice(0, 6), [cards]);

  const tiles = useMemo<MatchTile[]>(() => {
    const terms: MatchTile[] = roundCards.map((c) => ({
      uid: `term_${c.id}`,
      cardId: c.id,
      side: 'term',
      card: c,
    }));
    const meanings: MatchTile[] = roundCards.map((c) => ({
      uid: `meaning_${c.id}`,
      cardId: c.id,
      side: 'meaning',
      card: c,
    }));
    return [...terms, ...meanings].sort(() => Math.random() - 0.5);
  }, [roundCards]);

  const [selected, setSelected] = useState<MatchTile | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTileClick = (tile: MatchTile) => {
    if (matchedIds.has(tile.cardId) || wrongPair) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.uid === tile.uid) {
      setSelected(null);
      return;
    }
    if (selected.side === tile.side) {
      setSelected(tile);
      return;
    }

    setAttempts((a) => a + 1);

    if (selected.cardId === tile.cardId) {
      const nextMatched = new Set(matchedIds);
      nextMatched.add(tile.cardId);
      setMatchedIds(nextMatched);
      setSelected(null);

      const matchedCard = roundCards.find((c) => c.id === tile.cardId);
      if (matchedCard) {
        onPairMatched(matchedCard, 3);
      }

      if (nextMatched.size === roundCards.length) {
        const finalAttempts = attempts + 1;
        const acc = Math.round((roundCards.length / Math.max(1, finalAttempts)) * 100);
        setTimeout(() => onComplete(acc), 500);
      }
    } else {
      setWrongPair([selected.uid, tile.uid]);
      setSelected(null);
      setTimeout(() => setWrongPair(null), 500);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{t('study.matchTitle')}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Timer className="h-3.5 w-3.5" />
            {t('study.matchTime', { seconds: elapsedSec })}
          </Badge>
          <Badge variant="outline">
            {t('study.matchPairsLeft', { count: roundCards.length - matchedIds.size })}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => {
          const isMatched = matchedIds.has(tile.cardId);
          const isSelected = selected?.uid === tile.uid;
          const isWrong = wrongPair?.includes(tile.uid);

          return (
            <button
              key={tile.uid}
              type="button"
              disabled={isMatched}
              onClick={() => handleTileClick(tile)}
              className={cn(
                'flex min-h-[82px] items-center justify-center rounded-xl border p-3 text-center text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isMatched && 'border-emerald-500/40 bg-emerald-500/15 opacity-45',
                isSelected && 'border-primary bg-primary/15 ring-2 ring-primary',
                isWrong && 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300',
                !isMatched &&
                  !isSelected &&
                  !isWrong &&
                  'bg-card hover:border-primary/60 hover:bg-accent/50'
              )}
            >
              {tile.side === 'term' && isJapanese ? (
                <JapaneseTerm card={tile.card} showKanji={showKanji} />
              ) : (
                <span>{tile.side === 'term' ? tile.card.term : tile.card.meaning}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
