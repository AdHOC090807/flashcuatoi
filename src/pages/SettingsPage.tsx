import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { Volume2 } from 'lucide-react';
import { db } from '@/db';
import { resetAllData, updateSettings } from '@/db/actions';
import { seedDatabaseIfEmpty } from '@/db/seed';
import { getAvailableVoices, speakText } from '@/features/tts';
import { useToastStore } from '@/store/useToastStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AppLanguage, ThemeMode } from '@/types';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const loadVoices = () => setVoices(getAvailableVoices());
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  if (!settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleLanguageChange = async (lang: AppLanguage) => {
    await i18n.changeLanguage(lang);
    await updateSettings({ language: lang });
  };

  const handleReminderToggle = async (enabled: boolean) => {
    if (enabled && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        pushToast({
          title: t('settings.reminders'),
          description: 'Notification permission was denied by browser.',
          variant: 'warning',
        });
        await updateSettings({ remindersEnabled: false });
        return;
      }
      new Notification('LexiCards', {
        body: 'Daily vocabulary reminders enabled!',
      });
    }
    await updateSettings({ remindersEnabled: enabled });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.general')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pref-lang" className="mb-1.5 block text-sm font-medium">
              {t('settings.language')}
            </label>
            <select
              id="pref-lang"
              value={settings.language}
              onChange={(e) => void handleLanguageChange(e.target.value as AppLanguage)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </div>
          <div>
            <label htmlFor="pref-theme" className="mb-1.5 block text-sm font-medium">
              {t('settings.theme')}
            </label>
            <select
              id="pref-theme"
              value={settings.theme}
              onChange={(e) => void updateSettings({ theme: e.target.value as ThemeMode })}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="system">{t('settings.themeSystem')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* SRS */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.srs')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pref-new-limit" className="mb-1.5 block text-sm font-medium">
              {t('settings.dailyNewLimit')}
            </label>
            <Input
              id="pref-new-limit"
              type="number"
              min={1}
              max={200}
              value={settings.dailyNewLimit}
              onChange={(e) =>
                void updateSettings({ dailyNewLimit: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
          <div>
            <label htmlFor="pref-daily-goal" className="mb-1.5 block text-sm font-medium">
              {t('settings.dailyGoal')}
            </label>
            <Input
              id="pref-daily-goal"
              type="number"
              min={1}
              max={500}
              value={settings.dailyGoal}
              onChange={(e) =>
                void updateSettings({ dailyGoal: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* TTS */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.tts')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-tts-voice" className="mb-1.5 block text-sm font-medium">
                {t('settings.ttsVoice')}
              </label>
              <select
                id="pref-tts-voice"
                value={settings.ttsVoiceURI}
                onChange={(e) => void updateSettings({ ttsVoiceURI: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Default System Voice</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pref-tts-lang" className="mb-1.5 block text-sm font-medium">
                {t('settings.ttsLang')}
              </label>
              <Input
                id="pref-tts-lang"
                value={settings.ttsLang}
                onChange={(e) => void updateSettings({ ttsLang: e.target.value })}
                placeholder="en-US"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <label htmlFor="pref-tts-rate" className="mb-1 block text-sm font-medium">
                {t('settings.ttsRate', { rate: settings.ttsRate.toFixed(1) })}
              </label>
              <input
                id="pref-tts-rate"
                type="range"
                min={0.5}
                max={1.8}
                step={0.1}
                value={settings.ttsRate}
                onChange={(e) => void updateSettings({ ttsRate: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                speakText('Resilient learners practice every single day.', {
                  voiceURI: settings.ttsVoiceURI,
                  lang: settings.ttsLang,
                  rate: settings.ttsRate,
                })
              }
            >
              <Volume2 className="h-4 w-4" />
              <span>{t('settings.testVoice')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.reminders')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              id="pref-reminders"
              checked={settings.remindersEnabled}
              onCheckedChange={(v) => void handleReminderToggle(v)}
              aria-label={t('settings.enableReminders')}
            />
            <label htmlFor="pref-reminders" className="text-sm font-medium">
              {t('settings.enableReminders')}
            </label>
          </div>
          <Input
            type="time"
            aria-label={t('settings.reminderTime')}
            value={settings.reminderTime}
            onChange={(e) => void updateSettings({ reminderTime: e.target.value })}
            className="w-36"
          />
        </CardContent>
      </Card>

      {/* Optional AI Assist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{t('settings.ai')}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{t('settings.aiDesc')}</p>
            </div>
            <Switch
              checked={settings.aiEnabled}
              onCheckedChange={(v) => void updateSettings({ aiEnabled: v })}
              aria-label={t('settings.enableAi')}
            />
          </div>
        </CardHeader>
        {settings.aiEnabled && (
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="ai-key" className="mb-1 block text-xs font-medium">
                {t('settings.aiApiKey')}
              </label>
              <Input
                id="ai-key"
                type="password"
                value={settings.aiApiKey}
                onChange={(e) => void updateSettings({ aiApiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-endpoint" className="mb-1 block text-xs font-medium">
                  {t('settings.aiEndpoint')}
                </label>
                <Input
                  id="ai-endpoint"
                  value={settings.aiEndpoint}
                  onChange={(e) => void updateSettings({ aiEndpoint: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ai-model" className="mb-1 block text-xs font-medium">
                  {t('settings.aiModel')}
                </label>
                <Input
                  id="ai-model"
                  value={settings.aiModel}
                  onChange={(e) => void updateSettings({ aiModel: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              const seeded = await seedDatabaseIfEmpty();
              pushToast({
                title: t('settings.reseedSample'),
                description: seeded
                  ? 'Sample deck added.'
                  : 'Decks already exist — delete all first or import.',
                variant: seeded ? 'success' : 'default',
              });
            }}
          >
            {t('settings.reseedSample')}
          </Button>
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            {t('settings.resetData')}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('settings.resetData')}
        description={t('settings.resetConfirm')}
        confirmLabel={t('common.reset')}
        cancelLabel={t('common.cancel')}
        onConfirm={async () => {
          await resetAllData();
          pushToast({ title: t('settings.resetData'), variant: 'success' });
        }}
      />
    </div>
  );
}
