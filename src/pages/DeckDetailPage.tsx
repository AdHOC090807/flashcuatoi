import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRightLeft,
  Edit2,
  Gamepad2,
  Headphones,
  Keyboard,
  Layers,
  ListPlus,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { db } from '@/db';
import { deleteCards } from '@/db/actions';
import { getDeckCounts } from '@/features/srs/sm2';
import { startOfDayMs } from '@/lib/utils';
import { useToastStore } from '@/store/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { TtsButton } from '@/components/cards/TtsButton';
import { CardFormModal } from '@/components/cards/CardFormModal';
import { BulkAddModal } from '@/components/cards/BulkAddModal';
import { MoveCardModal } from '@/components/cards/MoveCardModal';
import type { Card } from '@/types';

export function DeckDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const deck = useLiveQuery(() => db.decks.get(id), [id]);
  const allDecks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(id).toArray(), [id]);
  const logs = useLiveQuery(() => db.reviewLogs.toArray());
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [singleDeleteCard, setSingleDeleteCard] = useState<Card | null>(null);

  const counts = useMemo(() => {
    if (!cards || !logs || !settings) return null;
    const todayStart = startOfDayMs();
    const newStudiedToday = new Set(
      logs
        .filter((l) => l.reviewedAt >= todayStart && l.previousInterval === 0)
        .map((l) => l.cardId)
    ).size;
    return getDeckCounts(cards, newStudiedToday, settings.dailyNewLimit);
  }, [cards, logs, settings]);

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    return cards
      .filter(
        (c) =>
          !q ||
          c.term.toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q))
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cards, search]);

  if (deck === undefined || !cards || !counts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">{t('notFound.title')}</p>
        <Link to="/decks" className="mt-4 inline-block">
          <Button>{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const toggleSelect = (cardId: string) => {
    setSelectedIds((prev) =>
      prev.includes(cardId) ? prev.filter((x) => x !== cardId) : [...prev, cardId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCards.map((c) => c.id));
    }
  };

  const studyModes = [
    { mode: 'flip', label: t('study.modes.flip'), icon: Layers },
    { mode: 'quiz', label: t('study.modes.quiz'), icon: Sparkles },
    { mode: 'typing', label: t('study.modes.typing'), icon: Keyboard },
    { mode: 'match', label: t('study.modes.match'), icon: Gamepad2 },
    { mode: 'listen', label: t('study.modes.listen'), icon: Headphones },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/decks">
            <Button variant="ghost" size="icon" aria-label={t('common.back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${deck.color}20` }}
          >
            {deck.emoji}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{deck.name}</h1>
            <p className="text-sm text-muted-foreground">{deck.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <ListPlus className="h-4 w-4" />
            <span>{t('cards.bulkAdd')}</span>
          </Button>
          <Button
            onClick={() => {
              setEditingCard(null);
              setCardModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>{t('cards.addCard')}</span>
          </Button>
        </div>
      </div>

      {/* Stats + Mode Launchers */}
      <UiCard>
        <CardContent className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('common.new')}: </span>
              <strong className="text-sky-600 dark:text-sky-400">{counts.newCount}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('common.learning')}: </span>
              <strong className="text-amber-600 dark:text-amber-400">{counts.learningCount}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('common.due')}: </span>
              <strong className="text-emerald-600 dark:text-emerald-400">{counts.dueCount}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">{t('common.mastered')}: </span>
              <strong>{counts.masteredCount}</strong>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {studyModes.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.mode} to={`/study/${deck.id}?mode=${item.mode}`}>
                  <Button
                    size="sm"
                    variant={item.mode === 'flip' ? 'default' : 'outline'}
                    disabled={cards.length === 0}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </UiCard>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filteredCards.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {selectedIds.length === filteredCards.length
                ? t('common.none')
                : t('cards.selectAll')}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>{t('cards.moveSelected')}</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('cards.bulkDelete', { count: selectedIds.length })}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards List */}
      {filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-lg font-semibold">{t('cards.noCards')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('cards.noCardsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${card.term}`}
                  checked={selectedIds.includes(card.id)}
                  onChange={() => toggleSelect(card.id)}
                  className="mt-1 h-4 w-4 rounded border-input accent-primary"
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base">{card.term}</span>
                    {card.phonetic && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {card.phonetic}
                      </span>
                    )}
                    {card.partOfSpeech && (
                      <Badge variant="outline" className="text-[11px]">
                        {card.partOfSpeech}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        card.status === 'new'
                          ? 'default'
                          : card.status === 'learning'
                            ? 'warning'
                            : 'success'
                      }
                      className="text-[11px]"
                    >
                      {t(`cards.status.${card.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{card.meaning}</p>
                  {card.example && (
                    <p className="text-xs italic text-muted-foreground">“{card.example}”</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <TtsButton text={card.term} size="icon" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('common.edit')} ${card.term}`}
                  onClick={() => {
                    setEditingCard(card);
                    setCardModalOpen(true);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={`${t('common.delete')} ${card.term}`}
                  onClick={() => setSingleDeleteCard(card)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CardFormModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        deckId={deck.id}
        editingCard={editingCard}
      />

      <BulkAddModal open={bulkOpen} onOpenChange={setBulkOpen} deckId={deck.id} />

      <MoveCardModal
        open={moveOpen}
        onOpenChange={setMoveOpen}
        cardIds={selectedIds}
        currentDeckId={deck.id}
        decks={allDecks ?? []}
        onMoved={() => setSelectedIds([])}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={t('common.delete')}
        description={t('cards.bulkDeleteConfirm', { count: selectedIds.length })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          await deleteCards(selectedIds);
          pushToast({
            title: t('common.delete'),
            description: `${selectedIds.length} ${t('common.cards')}`,
            variant: 'success',
          });
          setSelectedIds([]);
        }}
      />

      <ConfirmDialog
        open={Boolean(singleDeleteCard)}
        onOpenChange={(open) => {
          if (!open) setSingleDeleteCard(null);
        }}
        title={t('common.delete')}
        description={`Delete "${singleDeleteCard?.term ?? ''}"?`}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          if (!singleDeleteCard) return;
          await deleteCards([singleDeleteCard.id]);
          setSelectedIds((prev) => prev.filter((x) => x !== singleDeleteCard.id));
        }}
      />
    </div>
  );
}
