import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRightLeft,
  BookMarked,
  Edit2,
  Gamepad2,
  Headphones,
  Keyboard,
  Layers,
  ListPlus,
  Play,
  Plus,
  Repeat2,
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
import { Card as UiCard, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PasteImportButton } from '@/components/import/PasteImportButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { TtsButton } from '@/components/cards/TtsButton';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import { CardFormModal } from '@/components/cards/CardFormModal';
import { BulkAddModal } from '@/components/cards/BulkAddModal';
import { MoveCardModal } from '@/components/cards/MoveCardModal';
import type { Card } from '@/types';

export function DeckDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);

  const deck = useLiveQuery(() => db.decks.get(id), [id]);
  const allDecks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(id).toArray(), [id]);
  const logs = useLiveQuery(() => db.reviewLogs.toArray());
  const settings = useLiveQuery(() => db.settings.get('default'));

  const isJapanese = deck?.language === 'ja';
  const showKanji = Boolean(settings?.showKanji);

  const [search, setSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState<string>('all');
  const [lessonFrom, setLessonFrom] = useState<number>(1);
  const [lessonTo, setLessonTo] = useState<number>(1);
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

  const lessonGroups = useMemo(() => {
    if (!cards) return [];
    const map = new Map<number, Card[]>();
    cards.forEach((c) => {
      if (typeof c.lesson === 'number' && c.lesson > 0) {
        const arr = map.get(c.lesson) ?? [];
        arr.push(c);
        map.set(c.lesson, arr);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([lessonNum, lessonCards]) => {
        const learned = lessonCards.filter((c) => c.status !== 'new').length;
        const mastered = lessonCards.filter((c) => c.interval >= 21).length;
        const pct = Math.round((learned / lessonCards.length) * 100);
        return { lessonNum, total: lessonCards.length, learned, mastered, pct };
      });
  }, [cards]);

  const hasVerbConjugations = useMemo(() => {
    if (!cards) return false;
    return cards.some(
      (c) =>
        c.verbForms && (c.verbForms.masu || c.verbForms.te || c.verbForms.ta || c.verbForms.nai)
    );
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    return cards
      .filter((c) => {
        const matchesLesson = lessonFilter === 'all' || String(c.lesson ?? '') === lessonFilter;
        const matchesQuery =
          !q ||
          c.term.toLowerCase().includes(q) ||
          (c.kana?.toLowerCase().includes(q) ?? false) ||
          (c.romaji?.toLowerCase().includes(q) ?? false) ||
          (c.kanji?.toLowerCase().includes(q) ?? false) ||
          c.meaning.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q));
        return matchesLesson && matchesQuery;
      })
      .sort((a, b) => (a.lesson ?? 999) - (b.lesson ?? 999) || b.createdAt - a.createdAt);
  }, [cards, search, lessonFilter]);

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
    ...(isJapanese && hasVerbConjugations
      ? [{ mode: 'conjugation', label: t('japanese.conjugationDrill'), icon: Repeat2 }]
      : []),
  ];

  const minLesson = lessonGroups[0]?.lessonNum ?? 1;
  const maxLesson = lessonGroups[lessonGroups.length - 1]?.lessonNum ?? 1;

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{deck.name}</h1>
              {isJapanese && <Badge variant="secondary">日本語</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{deck.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PasteImportButton variant="outline" defaultDeckId={deck.id} />
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

      {/* Lessons Section (Bài 1..50) */}
      {(isJapanese || lessonGroups.length > 0) && lessonGroups.length > 0 && (
        <UiCard>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-4 w-4 text-primary" />
              <span>{t('japanese.lessonsTitle')}</span>
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t('japanese.studyRange')}:</span>
              <label className="flex items-center gap-1">
                <span>{t('japanese.from')}</span>
                <select
                  aria-label="Lesson range start"
                  value={lessonFrom || minLesson}
                  onChange={(e) => setLessonFrom(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {lessonGroups.map((g) => (
                    <option key={g.lessonNum} value={g.lessonNum}>
                      {t('japanese.lessonBadge', { num: g.lessonNum })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span>{t('japanese.to')}</span>
                <select
                  aria-label="Lesson range end"
                  value={Math.max(lessonFrom, lessonTo || maxLesson)}
                  onChange={(e) => setLessonTo(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {lessonGroups.map((g) => (
                    <option key={g.lessonNum} value={g.lessonNum}>
                      {t('japanese.lessonBadge', { num: g.lessonNum })}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                size="sm"
                onClick={() => {
                  const from = lessonFrom || minLesson;
                  const to = Math.max(from, lessonTo || maxLesson);
                  navigate(`/study/${deck.id}?mode=flip&lessonFrom=${from}&lessonTo=${to}`);
                }}
              >
                <Play className="h-3.5 w-3.5" />
                <span>{t('dashboard.studyNow')}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lessonGroups.map((g) => (
              <Link
                key={g.lessonNum}
                to={`/study/${deck.id}?mode=flip&lessonFrom=${g.lessonNum}&lessonTo=${g.lessonNum}`}
                className="rounded-xl border border-border p-3 transition hover:border-primary/60 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{t('japanese.lessonBadge', { num: g.lessonNum })}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.learned}/{g.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </Link>
            ))}
          </CardContent>
        </UiCard>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="pl-9"
            />
          </div>

          {lessonGroups.length > 0 && (
            <select
              aria-label={t('japanese.lessonsTitle')}
              value={lessonFilter}
              onChange={(e) => setLessonFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t('common.all')}</option>
              {lessonGroups.map((g) => (
                <option key={g.lessonNum} value={String(g.lessonNum)}>
                  {t('japanese.lessonBadge', { num: g.lessonNum })}
                </option>
              ))}
            </select>
          )}
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
                  aria-label={`Select ${card.kana || card.term}`}
                  checked={selectedIds.includes(card.id)}
                  onChange={() => toggleSelect(card.id)}
                  className="mt-1 h-4 w-4 rounded border-input accent-primary"
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base">
                      {isJapanese ? <JapaneseTerm card={card} showKanji={showKanji} /> : card.term}
                    </span>
                    {(card.romaji || card.phonetic) && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {card.romaji || card.phonetic}
                      </span>
                    )}
                    {(card.wordType || card.partOfSpeech) && (
                      <Badge variant="outline" className="text-[11px]">
                        {card.wordType || card.partOfSpeech}
                      </Badge>
                    )}
                    {card.lesson && (
                      <Badge variant="secondary" className="text-[11px]">
                        {t('japanese.lessonBadge', { num: card.lesson })}
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
                    <p
                      lang={isJapanese ? 'ja' : undefined}
                      className={`text-xs text-muted-foreground ${isJapanese ? 'font-jp' : 'italic'}`}
                    >
                      “{card.example}”
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <TtsButton
                  text={isJapanese ? card.kana || card.term : card.term}
                  lang={isJapanese ? 'ja-JP' : undefined}
                  audioUrl={card.audioUrl}
                  size="icon"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('common.edit')} ${card.kana || card.term}`}
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
                  aria-label={`${t('common.delete')} ${card.kana || card.term}`}
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
        description={`Delete "${singleDeleteCard?.kana || singleDeleteCard?.term || ''}"?`}
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
