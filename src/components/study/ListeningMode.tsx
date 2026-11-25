import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, RotateCcw, Volume2, XCircle } from 'lucide-react';
import { db } from '@/db';
import { updateSettings } from '@/db/actions';
import { buildJapaneseSampleCards, SAMPLE_WORDS } from '@/db/seed';
import { getDisplayKana, isJapaneseMatch, pickJapaneseQuizDistractors } from '@/features/japanese';
import { debouncedPlayTTS, playTTS, resolveTTSProvider, stopSpeaking } from '@/features/tts';
import { isTolerantMatch, cn } from '@/lib/utils';
import { Card as UiCard, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { JapaneseTerm } from '@/components/cards/JapaneseTerm';
import type { Card, ReviewRating } from '@/types';

interface ListeningModeProps {
  card: Card;
  deckCards: Card[];
  isJapanese?: boolean;
  showKanji?: boolean;
  onAnswered: (rating: ReviewRating, correct: boolean) => void;
}

export function ListeningMode({
  card,
  deckCards,
  isJapanese = false,
  showKanji = false,
  onAnswered,
}: ListeningModeProps) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [subMode, setSubMode] = useState<'pick' | 'type'>('pick');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedResult, setTypedResult] = useState<boolean | null>(null);

  const ttsLang = isJapanese ? 'ja-JP' : settings?.ttsLang || 'en-US';
  const spokenText = isJapanese ? getDisplayKana(card) : card.term;
  const rate = settings?.ttsRate ?? 1.0;

  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  const playAudio = () => {
    void playTTS(spokenText, {
      voiceURI: settings?.ttsVoiceURI,
      lang: ttsLang,
      rate,
      audioUrl: card.audioUrl,
      provider: resolveTTSProvider(settings),
      elevenLabsApiKey: settings?.elevenLabsApiKey,
      elevenLabsVoiceId: settings?.elevenLabsVoiceId,
      elevenLabsModel: settings?.elevenLabsModel,
      onStatusChange: setAudioStatus,
    });
  };

  useEffect(() => {
    setSelectedId(null);
    setTyped('');
    setTypedResult(null);
    debouncedPlayTTS(spokenText, {
      voiceURI: settings?.ttsVoiceURI,
      lang: ttsLang,
      rate,
      audioUrl: card.audioUrl,
      provider: resolveTTSProvider(settings),
      elevenLabsApiKey: settings?.elevenLabsApiKey,
      elevenLabsVoiceId: settings?.elevenLabsVoiceId,
      elevenLabsModel: settings?.elevenLabsModel,
      onStatusChange: setAudioStatus,
    });
    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const options = useMemo(() => {
    if (isJapanese) {
      let distractors = pickJapaneseQuizDistractors(card, deckCards, 3);
      if (distractors.length < 3) {
        const extra = pickJapaneseQuizDistractors(
          card,
          buildJapaneseSampleCards(),
          3 - distractors.length
        );
        const used = new Set([card.id, ...distractors.map((d) => d.id)]);
        for (const ex of extra) {
          if (!used.has(ex.id) && distractors.length < 3) {
            distractors = [...distractors, ex];
            used.add(ex.id);
          }
        }
      }
      return [
        { id: card.id, card, isCorrect: true },
        ...distractors.map((d) => ({ id: d.id, card: d, isCorrect: false })),
      ].sort(() => Math.random() - 0.5);
    }

    const distractors = deckCards
      .filter((c) => c.id !== card.id && c.meaning.trim() !== card.meaning.trim())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (distractors.length < 3) {
      const seen = new Set([card.meaning, ...distractors.map((d) => d.meaning)]);
      for (const sample of SAMPLE_WORDS) {
        if (distractors.length >= 3) break;
        if (!seen.has(sample.meaning)) {
          seen.add(sample.meaning);
          distractors.push({
            ...card,
            id: `fb_${sample.term}`,
            term: sample.term,
            meaning: sample.meaning,
          });
        }
      }
    }

    return [
      { id: card.id, card, isCorrect: true },
      ...distractors.map((d) => ({ id: d.id, card: d, isCorrect: false })),
    ].sort(() => Math.random() - 0.5);
  }, [card, deckCards, isJapanese]);

  const handlePick = (opt: { id: string; isCorrect: boolean }) => {
    if (selectedId) return;
    setSelectedId(opt.id);
    setTimeout(() => {
      onAnswered(opt.isCorrect ? 3 : 1, opt.isCorrect);
    }, 900);
  };

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim() || typedResult !== null) return;
    const res = isJapanese ? isJapaneseMatch(typed, card) : isTolerantMatch(typed, card.term);
    setTypedResult(res.isMatch);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex justify-center gap-2">
        <Button
          size="sm"
          variant={subMode === 'pick' ? 'default' : 'outline'}
          onClick={() => setSubMode('pick')}
        >
          {isJapanese ? t('japanese.chooseKana') : t('study.listenModePick')}
        </Button>
        <Button
          size="sm"
          variant={subMode === 'type' ? 'default' : 'outline'}
          onClick={() => setSubMode('type')}
        >
          {t('study.listenModeType')}
        </Button>
      </div>

      <UiCard>
        <CardContent className="flex flex-col items-center p-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('study.listenPrompt')}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Button
              size="lg"
              onClick={playAudio}
              disabled={audioStatus === 'loading'}
              className="h-16 w-16 rounded-full shadow-md"
              aria-label={t('study.listenPlay')}
            >
              <Volume2 className="h-7 w-7" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={playAudio}
              aria-label={t('japanese.replayAudio')}
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t('japanese.replayAudio')}</span>
            </Button>
          </div>
          <div className="mt-4 flex w-full max-w-xs items-center gap-3 text-xs text-muted-foreground">
            <span>{rate.toFixed(1)}x</span>
            <input
              aria-label={t('settings.ttsRate', { rate: rate.toFixed(1) })}
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={rate}
              onChange={(e) => void updateSettings({ ttsRate: Number(e.target.value) })}
              className="flex-1 accent-primary"
            />
          </div>
        </CardContent>
      </UiCard>

      {subMode === 'pick' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const isSelected = selectedId === opt.id;
            const showResult = selectedId !== null;
            return (
              <Button
                key={`${card.id}-${opt.id}`}
                variant="outline"
                disabled={showResult}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handlePick(opt);
                }}
                className={cn(
                  'h-auto min-h-[60px] justify-between px-4 py-3 text-left whitespace-normal touch-manipulation select-none',
                  showResult &&
                    opt.isCorrect &&
                    'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                  showResult &&
                    isSelected &&
                    !opt.isCorrect &&
                    'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200'
                )}
              >
                <span className="text-sm font-medium">
                  {isJapanese ? (
                    <JapaneseTerm card={opt.card} showKanji={showKanji} />
                  ) : (
                    opt.card.meaning
                  )}
                </span>
                {showResult && opt.isCorrect && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {showResult && isSelected && !opt.isCorrect && (
                  <XCircle className="h-4 w-4 text-rose-600" />
                )}
              </Button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleTypeSubmit} className="space-y-3">
          <Input
            lang={isJapanese ? 'ja' : undefined}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={typedResult !== null}
            placeholder={
              isJapanese ? t('japanese.typingPlaceholder') : t('study.typingPlaceholder')
            }
            className="h-12 text-base"
          />
          {typedResult === null ? (
            <Button type="submit" size="lg" className="w-full" disabled={!typed.trim()}>
              {t('study.checkAnswer')}
            </Button>
          ) : (
            <div className="space-y-3">
              <div
                className={`rounded-xl border p-4 text-sm ${
                  typedResult
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                }`}
              >
                <p className="font-semibold">
                  {typedResult
                    ? `${t('study.exactMatch')} (${spokenText} — ${card.meaning})`
                    : `${t('study.incorrectAnswer', { expected: spokenText })} (${card.meaning})`}
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={() => onAnswered(typedResult ? 3 : 1, typedResult)}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
