import { useState } from 'react';
import { AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '@/db';
import { isTTSSupported, playTTS, resolveTTSProvider } from '@/features/tts';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function TtsButton({
  text,
  lang,
  audioUrl,
  size = 'icon',
  label,
  className,
}: {
  text: string;
  lang?: string;
  audioUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  if (!isTTSSupported()) return null;

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    void playTTS(text, {
      voiceURI: settings?.ttsVoiceURI,
      lang: lang || settings?.ttsLang || 'en-US',
      rate: settings?.ttsRate ?? 1.0,
      audioUrl,
      provider: resolveTTSProvider(settings),
      elevenLabsApiKey: settings?.elevenLabsApiKey,
      elevenLabsVoiceId: settings?.elevenLabsVoiceId,
      elevenLabsModel: settings?.elevenLabsModel,
      onStatusChange: setStatus,
    });
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleSpeak}
      disabled={status === 'loading'}
      aria-label={label || t('cards.speak')}
      title={status === 'error' ? t('tts.fallbackError') : label || t('cards.speak')}
      className={cn(
        status === 'error' && 'border-amber-500/60 text-amber-600 dark:text-amber-400',
        className
      )}
    >
      {status === 'loading' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === 'error' ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
      {label && <span>{label}</span>}
    </Button>
  );
}
