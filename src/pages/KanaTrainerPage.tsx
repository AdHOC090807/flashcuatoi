import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, RotateCw, Volume2, XCircle } from 'lucide-react';
import { db } from '@/db';
import {
  ALL_KANA_ITEMS,
  KANA_ROWS,
  type KanaItem,
  type KanaRowGroup,
  type KanaScript,
} from '@/features/japanese/kanaData';
import { speakText } from '@/features/tts';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type TrainerMode = 'chart' | 'flashcards' | 'quiz';

const ALL_GROUPS: KanaRowGroup[] = ['basic', 'dakuten', 'handakuten', 'yoon'];

export function KanaTrainerPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));

  const [script, setScript] = useState<KanaScript>('hiragana');
  const [trainerMode, setTrainerMode] = useState<TrainerMode>('chart');
  const [activeGroups, setActiveGroups] = useState<KanaRowGroup[]>(['basic']);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Flashcard state
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  const availableRows = useMemo(
    () => KANA_ROWS.filter((r) => activeGroups.includes(r.group)),
    [activeGroups]
  );

  const filteredItems = useMemo(() => {
    const byGroup = ALL_KANA_ITEMS.filter((item) => activeGroups.includes(item.group));
    if (selectedRows.length === 0) return byGroup;
    return byGroup.filter((item) => selectedRows.includes(item.row));
  }, [activeGroups, selectedRows]);

  const deckItems = useMemo(() => {
    if (filteredItems.length > 0) return filteredItems;
    return ALL_KANA_ITEMS.filter((i) => i.group === 'basic');
  }, [filteredItems]);

  const speakKana = (item: KanaItem) => {
    const glyph = script === 'hiragana' ? item.hiragana : item.katakana;
    speakText(glyph, {
      voiceURI: settings?.ttsVoiceURI,
      lang: 'ja-JP',
      rate: settings?.ttsRate ?? 1.0,
    });
  };

  const toggleGroup = (group: KanaRowGroup) => {
    setActiveGroups((prev) => {
      if (prev.includes(group)) {
        return prev.length === 1 ? prev : prev.filter((g) => g !== group);
      }
      return [...prev, group];
    });
    setSelectedRows([]);
    setCardIndex(0);
    setQuizIndex(0);
  };

  const toggleRow = (rowName: string) => {
    setSelectedRows((prev) =>
      prev.includes(rowName) ? prev.filter((r) => r !== rowName) : [...prev, rowName]
    );
    setCardIndex(0);
    setQuizIndex(0);
  };

  const currentFlashcard = deckItems[cardIndex % deckItems.length];
  const currentQuizTarget = deckItems[quizIndex % deckItems.length];

  const quizOptions = useMemo(() => {
    const pool = deckItems.filter((item) => item.id !== currentQuizTarget.id);
    const fallback = ALL_KANA_ITEMS.filter((item) => item.id !== currentQuizTarget.id);
    const distractors = (pool.length >= 3 ? pool : fallback)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [currentQuizTarget, ...distractors].sort(() => Math.random() - 0.5);
  }, [currentQuizTarget, deckItems]);

  const handleQuizAnswer = (chosen: KanaItem) => {
    if (quizSelected) return;
    const isCorrect = chosen.id === currentQuizTarget.id;
    setQuizSelected(chosen.id);
    setQuizScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
    speakKana(currentQuizTarget);
    setTimeout(() => {
      setQuizSelected(null);
      setQuizIndex((idx) => (idx + 1) % deckItems.length);
    }, 850);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('kana.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('kana.subtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(['hiragana', 'katakana'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScript(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  script === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`kana.${s}`)}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(['chart', 'flashcards', 'quiz'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setTrainerMode(m);
                  setFlipped(false);
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  trainerMode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`kana.modes.${m}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Group & Row Selectors */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('kana.rowGroups')}:
            </span>
            {ALL_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => toggleGroup(group)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  activeGroups.includes(group)
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {t(`kana.groups.${group}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{t('kana.rows')}:</span>
            <button
              type="button"
              onClick={() => setSelectedRows([])}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium transition',
                selectedRows.length === 0
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {t('common.all')}
            </button>
            {availableRows.map((rowDef) => (
              <button
                key={rowDef.row}
                type="button"
                onClick={() => toggleRow(rowDef.row)}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs font-medium transition',
                  selectedRows.includes(rowDef.row)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {rowDef.row}-row
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart Mode */}
      {trainerMode === 'chart' && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-8">
          {deckItems.map((item) => {
            const glyph = script === 'hiragana' ? item.hiragana : item.katakana;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => speakKana(item)}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-3 transition hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span lang="ja" className="text-2xl font-bold font-jp">
                  {glyph}
                </span>
                <span className="mt-1 font-mono text-xs text-muted-foreground">{item.romaji}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Flashcards Mode */}
      {trainerMode === 'flashcards' && currentFlashcard && (
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {(cardIndex % deckItems.length) + 1} / {deckItems.length}
            </span>
            <Badge variant="outline">{t(`kana.groups.${currentFlashcard.group}`)}</Badge>
          </div>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                setFlipped((f) => !f);
              }
            }}
            className="cursor-pointer transition hover:border-primary/60"
          >
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
              <span lang="ja" className="text-6xl font-bold font-jp">
                {script === 'hiragana' ? currentFlashcard.hiragana : currentFlashcard.katakana}
              </span>
              {flipped ? (
                <div className="mt-4 space-y-1">
                  <p className="font-mono text-2xl font-bold text-primary">
                    {currentFlashcard.romaji}
                  </p>
                  <p lang="ja" className="text-sm text-muted-foreground font-jp">
                    {script === 'hiragana' ? currentFlashcard.katakana : currentFlashcard.hiragana}
                  </p>
                </div>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{t('study.showAnswer')}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFlipped(false);
                setCardIndex((i) => (i - 1 + deckItems.length) % deckItems.length);
              }}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => speakKana(currentFlashcard)}
              aria-label={t('study.listenPlay')}
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setFlipped(false);
                setCardIndex((i) => (i + 1) % deckItems.length);
              }}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Quiz Mode */}
      {trainerMode === 'quiz' && currentQuizTarget && (
        <div className="mx-auto max-w-lg space-y-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('kana.quizPrompt')}</span>
            <Badge variant="secondary">
              {quizScore.correct} / {quizScore.total}
            </Badge>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <span lang="ja" className="text-6xl font-bold font-jp">
                {script === 'hiragana' ? currentQuizTarget.hiragana : currentQuizTarget.katakana}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => speakKana(currentQuizTarget)}
              >
                <Volume2 className="h-4 w-4" />
                <span>{t('study.listenPlay')}</span>
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {quizOptions.map((opt) => {
              const isChosen = quizSelected === opt.id;
              const isCorrect = opt.id === currentQuizTarget.id;
              const show = quizSelected !== null;
              return (
                <Button
                  key={opt.id}
                  variant="outline"
                  disabled={show}
                  onClick={() => handleQuizAnswer(opt)}
                  className={cn(
                    'h-14 justify-between font-mono text-base',
                    show &&
                      isCorrect &&
                      'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                    show &&
                      isChosen &&
                      !isCorrect &&
                      'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  )}
                >
                  <span>{opt.romaji}</span>
                  {show && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  {show && isChosen && !isCorrect && <XCircle className="h-4 w-4 text-rose-600" />}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
