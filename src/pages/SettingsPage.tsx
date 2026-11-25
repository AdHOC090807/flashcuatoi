import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Volume2 } from 'lucide-react';
import { db } from '@/db';
import { resetAllData, updateSettings } from '@/db/actions';
import { seedDatabaseIfEmpty, seedJapaneseSampleDeck } from '@/db/seed';
import {
  checkProxyHealth,
  getAvailableVoices,
  getProxyUrl,
  playTTS,
  resolveTTSProvider,
} from '@/features/tts';
import { useToastStore } from '@/store/useToastStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AppLanguage, SwipeSensitivity, ThemeMode, TTSProviderType } from '@/types';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const pushToast = useToastStore((s) => s.pushToast);
  const settings = useLiveQuery(() => db.settings.get('default'));
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<
    'checking' | 'reachable' | 'error' | 'unconfigured'
  >('checking');

  const proxyUrl = getProxyUrl();

  const refreshProxyStatus = async () => {
    setProxyStatus('checking');
    const result = await checkProxyHealth(proxyUrl);
    setProxyStatus(result);
  };

  useEffect(() => {
    void refreshProxyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyUrl]);

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

      {/* Japanese Display & Audio */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.japaneseTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="pref-show-kanji" className="text-sm font-medium">
                {t('settings.showKanji')}
              </label>
              <p className="text-xs text-muted-foreground">{t('settings.showKanjiDesc')}</p>
            </div>
            <Switch
              id="pref-show-kanji"
              checked={Boolean(settings.showKanji)}
              onCheckedChange={(v) => void updateSettings({ showKanji: v })}
              aria-label={t('settings.showKanji')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <label htmlFor="pref-tts-autoplay" className="text-sm font-medium">
              {t('settings.ttsAutoplay')}
            </label>
            <Switch
              id="pref-tts-autoplay"
              checked={Boolean(settings.autoReadOnArrival ?? settings.ttsAutoplay ?? true)}
              onCheckedChange={(v) => void updateSettings({ autoReadOnArrival: v, ttsAutoplay: v })}
              aria-label={t('settings.ttsAutoplay')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Swipe & Gestures */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.swipeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="pref-swipe-enabled" className="text-sm font-medium">
                {t('settings.swipeEnabled')}
              </label>
              <p className="text-xs text-muted-foreground">{t('settings.swipeEnabledDesc')}</p>
            </div>
            <Switch
              id="pref-swipe-enabled"
              checked={settings.swipeEnabled ?? true}
              onCheckedChange={(v) => void updateSettings({ swipeEnabled: v })}
              aria-label={t('settings.swipeEnabled')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <div>
              <label htmlFor="pref-swipe-before-flip" className="text-sm font-medium">
                {t('settings.allowSwipeBeforeFlip')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('settings.allowSwipeBeforeFlipDesc')}
              </p>
            </div>
            <Switch
              id="pref-swipe-before-flip"
              checked={settings.allowSwipeBeforeFlip ?? true}
              onCheckedChange={(v) => void updateSettings({ allowSwipeBeforeFlip: v })}
              aria-label={t('settings.allowSwipeBeforeFlip')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
            <div>
              <label htmlFor="pref-swipe-vertical" className="text-sm font-medium">
                {t('settings.swipeVerticalEnabled')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('settings.swipeVerticalEnabledDesc')}
              </p>
            </div>
            <Switch
              id="pref-swipe-vertical"
              checked={settings.swipeVerticalEnabled ?? true}
              onCheckedChange={(v) => void updateSettings({ swipeVerticalEnabled: v })}
              aria-label={t('settings.swipeVerticalEnabled')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-swipe-threshold" className="mb-1.5 block text-sm font-medium">
                {t('settings.swipeThreshold')}
              </label>
              <select
                id="pref-swipe-threshold"
                value={settings.swipeThreshold ?? 100}
                onChange={(e) =>
                  void updateSettings({
                    swipeThreshold: Number(e.target.value) as SwipeSensitivity,
                  })
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value={60}>{t('settings.swipeThresholdLight')}</option>
                <option value={100}>{t('settings.swipeThresholdMedium')}</option>
                <option value={140}>{t('settings.swipeThresholdFirm')}</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 sm:pt-6">
              <label htmlFor="pref-haptics-enabled" className="text-sm font-medium">
                {t('settings.hapticsEnabled')}
              </label>
              <Switch
                id="pref-haptics-enabled"
                checked={settings.hapticsEnabled ?? true}
                onCheckedChange={(v) => void updateSettings({ hapticsEnabled: v })}
                aria-label={t('settings.hapticsEnabled')}
              />
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('settings.tts')}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  proxyStatus === 'reachable'
                    ? 'success'
                    : proxyStatus === 'error'
                      ? 'danger'
                      : 'secondary'
                }
              >
                {t(`tts.proxyStatus.${proxyStatus}`)}
              </Badge>
              {proxyUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refreshProxyStatus()}
                  aria-label={t('tts.checkProxy')}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pref-tts-provider" className="mb-1.5 block text-sm font-medium">
                {t('tts.provider')}
              </label>
              <select
                id="pref-tts-provider"
                value={resolveTTSProvider(settings)}
                onChange={(e) =>
                  void updateSettings({ ttsProvider: e.target.value as TTSProviderType })
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="proxy" disabled={!proxyUrl}>
                  {proxyUrl ? t('tts.providerProxy') : t('tts.providerProxyUnconfigured')}
                </option>
                <option value="webspeech">{t('tts.providerWebSpeech')}</option>
                <option value="elevenlabs_byok">{t('tts.providerByok')}</option>
              </select>
            </div>
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
          </div>

          {resolveTTSProvider(settings) === 'elevenlabs_byok' && (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-3">
              <div>
                <label htmlFor="el-key" className="mb-1 block text-xs font-medium">
                  {t('tts.byokApiKey')}
                </label>
                <Input
                  id="el-key"
                  type="password"
                  value={settings.elevenLabsApiKey || ''}
                  onChange={(e) => void updateSettings({ elevenLabsApiKey: e.target.value })}
                  placeholder="xi-..."
                />
              </div>
              <div>
                <label htmlFor="el-voice" className="mb-1 block text-xs font-medium">
                  {t('tts.byokVoiceId')}
                </label>
                <Input
                  id="el-voice"
                  value={settings.elevenLabsVoiceId || ''}
                  onChange={(e) => void updateSettings({ elevenLabsVoiceId: e.target.value })}
                  placeholder="21m00Tcm4TlvDq8ikWAM"
                />
              </div>
              <div>
                <label htmlFor="el-model" className="mb-1 block text-xs font-medium">
                  {t('tts.byokModel')}
                </label>
                <Input
                  id="el-model"
                  value={settings.elevenLabsModel || ''}
                  onChange={(e) => void updateSettings({ elevenLabsModel: e.target.value })}
                  placeholder="eleven_multilingual_v2"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="flex flex-col justify-end">
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
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void playTTS('Resilient learners practice every single day.', {
                  voiceURI: settings.ttsVoiceURI,
                  lang: settings.ttsLang,
                  rate: settings.ttsRate,
                  provider: resolveTTSProvider(settings),
                  elevenLabsApiKey: settings.elevenLabsApiKey,
                  elevenLabsVoiceId: settings.elevenLabsVoiceId,
                  elevenLabsModel: settings.elevenLabsModel,
                })
              }
            >
              <Volume2 className="h-4 w-4" />
              <span>{t('settings.testVoice')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void playTTS('にほんごのべんきょうをがんばりましょう。', {
                  lang: 'ja-JP',
                  rate: settings.ttsRate,
                  provider: resolveTTSProvider(settings),
                  elevenLabsApiKey: settings.elevenLabsApiKey,
                  elevenLabsVoiceId: settings.elevenLabsVoiceId,
                  elevenLabsModel: settings.elevenLabsModel,
                })
              }
            >
              <Volume2 className="h-4 w-4" />
              <span>{t('settings.testJaVoice')}</span>
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
                  ? 'Sample decks added.'
                  : 'Decks already exist — delete all first or import.',
                variant: seeded ? 'success' : 'default',
              });
            }}
          >
            {t('settings.reseedSample')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const added = await seedJapaneseSampleDeck();
              pushToast({
                title: t('settings.addJaSample'),
                description: added
                  ? 'Beginner Japanese deck added.'
                  : 'Japanese starter deck already exists.',
                variant: added ? 'success' : 'default',
              });
            }}
          >
            {t('settings.addJaSample')}
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
