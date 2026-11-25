import { Volume2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '@/db';
import { isTTSSupported, speakText } from '@/features/tts';
import { Button } from '@/components/ui/Button';

export function TtsButton({
  text,
  lang,
  size = 'icon',
  label,
  className,
}: {
  text: string;
  lang?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('default'));

  if (!isTTSSupported()) return null;

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakText(text, {
      voiceURI: settings?.ttsVoiceURI,
      lang: lang || settings?.ttsLang || 'en-US',
      rate: settings?.ttsRate ?? 1.0,
    });
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleSpeak}
      aria-label={label || t('cards.speak')}
      title={label || t('cards.speak')}
      className={className}
    >
      <Volume2 className="h-4 w-4" />
      {label && <span>{label}</span>}
    </Button>
  );
}
