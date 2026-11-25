import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Search } from 'lucide-react';
import { db } from '@/db';
import { deleteDeck } from '@/db/actions';
import { getDeckCounts } from '@/features/srs/sm2';
import { startOfDayMs } from '@/lib/utils';
import { useToastStore } from '@/store/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DeckCard } from '@/components/decks/DeckCard';
import { DeckFormModal } from '@/components/decks/DeckFormModal';
import type { Deck } from '@/types';

type SortOption = 'updated' | 'name' | 'due';

export function DecksPage() {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const decks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const logs = useLiveQuery(() => db.reviewLogs.toArray());
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);

  const allTags = useMemo(() => {
    if (!decks) return [];
    const set = new Set<string>();
    decks.forEach((d) => d.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [decks]);

  const enrichedDecks = useMemo(() => {
    if (!decks || !cards || !logs || !settings) return null;
    const now = Date.now();
    const todayStart = startOfDayMs(now);
    const newStudiedToday = new Set(
      logs
        .filter((l) => l.reviewedAt >= todayStart && l.previousInterval === 0)
        .map((l) => l.cardId)
    ).size;

    const q = query.trim().toLowerCase();

    return decks
      .filter((d) => {
        const matchesQuery =
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.tags.some((tag) => tag.toLowerCase().includes(q));
        const matchesTag = selectedTag === 'all' || d.tags.includes(selectedTag);
        return matchesQuery && matchesTag;
      })
      .map((deck) => {
        const deckCards = cards.filter((c) => c.deckId === deck.id);
        const counts = getDeckCounts(deckCards, newStudiedToday, settings.dailyNewLimit, now);
        return { deck, counts };
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.deck.name.localeCompare(b.deck.name);
        if (sortBy === 'due') {
          const dueA = a.counts.newCount + a.counts.learningCount + a.counts.dueCount;
          const dueB = b.counts.newCount + b.counts.learningCount + b.counts.dueCount;
          return dueB - dueA;
        }
        return b.deck.updatedAt - a.deck.updatedAt;
      });
  }, [decks, cards, logs, settings, query, selectedTag, sortBy]);

  if (!enrichedDecks) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('decks.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('decks.subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditingDeck(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          <span>{t('decks.newDeck')}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('decks.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            aria-label={t('decks.filterTag')}
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t('common.all')}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>

          <select
            aria-label={t('decks.sortBy')}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="updated">{t('decks.sortUpdated')}</option>
            <option value="name">{t('decks.sortName')}</option>
            <option value="due">{t('decks.sortDue')}</option>
          </select>
        </div>
      </div>

      {/* Deck Grid */}
      {enrichedDecks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">{t('decks.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('decks.emptyDesc')}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditingDeck(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>{t('decks.newDeck')}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enrichedDecks.map(({ deck, counts }) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              counts={counts}
              onEdit={(d) => {
                setEditingDeck(d);
                setModalOpen(true);
              }}
              onDelete={(d) => setDeletingDeck(d)}
            />
          ))}
        </div>
      )}

      <DeckFormModal open={modalOpen} onOpenChange={setModalOpen} editingDeck={editingDeck} />

      <ConfirmDialog
        open={Boolean(deletingDeck)}
        onOpenChange={(open) => {
          if (!open) setDeletingDeck(null);
        }}
        title={t('decks.deleteDeck')}
        description={t('decks.deleteConfirm', {
          name: deletingDeck?.name ?? '',
          count: cards?.filter((c) => c.deckId === deletingDeck?.id).length ?? 0,
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          if (!deletingDeck) return;
          await deleteDeck(deletingDeck.id);
          pushToast({
            title: t('decks.deleteDeck'),
            description: deletingDeck.name,
            variant: 'success',
          });
        }}
      />
    </div>
  );
}
