import { db, getDefaultTTSProvider } from '@/db';
import { useToastStore } from '@/store/useToastStore';
import type { TTSProviderType, UserSettings } from '@/types';

export interface TTSOptions {
  voiceURI?: string;
  lang?: string;
  rate?: number;
  audioUrl?: string;
  provider?: TTSProviderType;
  proxyUrl?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModel?: string;
  signal?: AbortSignal;
  onStatusChange?: (status: 'idle' | 'loading' | 'playing' | 'error') => void;
}

export interface TTSPlaybackResult {
  usedProvider: 'card_audio' | 'idb_cache' | 'proxy' | 'elevenlabs_byok' | 'webspeech' | 'none';
  fallbackUsed: boolean;
  error?: string;
}

let activeController: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

export function getProxyUrl(): string {
  return (import.meta.env.VITE_TTS_PROXY_URL || '').trim().replace(/\/+$/, '');
}

export function resolveTTSProvider(settings?: Partial<UserSettings>): TTSProviderType {
  if (settings?.ttsProvider) {
    if (settings.ttsProvider === 'proxy' && !getProxyUrl()) {
      return 'webspeech';
    }
    return settings.ttsProvider;
  }
  return getDefaultTTSProvider();
}

export function isTTSSupported(): boolean {
  return (
    typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined')
  );
}

export function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isWebSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function pickVoiceForLang(
  lang: string,
  preferredVoiceURI?: string
): SpeechSynthesisVoice | undefined {
  const voices = getAvailableVoices();
  if (voices.length === 0) return undefined;

  const targetPrefix = lang.split('-')[0].toLowerCase();
  if (preferredVoiceURI) {
    const preferred = voices.find((v) => v.voiceURI === preferredVoiceURI);
    if (preferred && preferred.lang.toLowerCase().startsWith(targetPrefix)) {
      return preferred;
    }
  }

  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix))
  );
}

export function speakWithWebSpeech(text: string, options: TTSOptions = {}): boolean {
  if (!isWebSpeechSupported() || !text.trim()) return false;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = options.lang || 'en-US';
    utterance.lang = targetLang;
    utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1));

    const matchedVoice = pickVoiceForLang(targetLang, options.voiceURI);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

// Keep backward-compatible synchronous helper
export function speakText(text: string, options: TTSOptions = {}): boolean {
  return speakWithWebSpeech(text, options);
}

function cleanupActiveAudio(): void {
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.removeAttribute('src');
    } catch {
      // Ignore cleanup errors
    }
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export function stopSpeaking(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  cleanupActiveAudio();
  if (isWebSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

async function playAudioSource(src: string, rate: number): Promise<void> {
  const audio = getSharedAudio();
  if (!audio) {
    throw new Error('HTMLAudioElement is unavailable in this environment');
  }
  audio.playbackRate = Math.min(2, Math.max(0.5, rate || 1));
  audio.src = src;
  await audio.play();
}

async function playAudioBytes(buffer: ArrayBuffer, mimeType: string, rate: number): Promise<void> {
  cleanupActiveAudio();
  const blob = new Blob([buffer], { type: mimeType || 'audio/mpeg' });
  activeObjectUrl = URL.createObjectURL(blob);
  await playAudioSource(activeObjectUrl, rate);
}

export function buildTTSCacheKey(
  text: string,
  lang: string,
  voiceId: string,
  model: string
): string {
  return `${lang}::${voiceId}::${model}::${text.trim()}`;
}

export class ProxyTTSProvider {
  readonly baseUrl: string;

  constructor(baseUrl: string = getProxyUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async fetchAudio(
    params: { text: string; lang: string; voiceId?: string; model?: string },
    signal?: AbortSignal
  ): Promise<{ data: ArrayBuffer; mimeType: string }> {
    if (!this.baseUrl) {
      throw new Error('TTS proxy URL is not configured');
    }
    const response = await fetch(`${this.baseUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.text.trim().slice(0, 200),
        lang: params.lang,
        voiceId: params.voiceId || undefined,
        model: params.model || undefined,
      }),
      signal,
    });

    if (!response.ok) {
      let message = `Proxy TTS failed (${response.status})`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody?.error) message = errBody.error;
      } catch {
        // Ignore parse error
      }
      throw new Error(message);
    }

    const data = await response.arrayBuffer();
    return {
      data,
      mimeType: response.headers.get('Content-Type') || 'audio/mpeg',
    };
  }
}

export class ElevenLabsBYOKProvider {
  async fetchAudio(
    params: {
      text: string;
      apiKey: string;
      voiceId?: string;
      model?: string;
    },
    signal?: AbortSignal
  ): Promise<{ data: ArrayBuffer; mimeType: string }> {
    if (!params.apiKey.trim()) {
      throw new Error('ElevenLabs API key is missing');
    }
    const voiceId = params.voiceId?.trim() || '21m00Tcm4TlvDq8ikWAM';
    const model = params.model?.trim() || 'eleven_multilingual_v2';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': params.apiKey.trim(),
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: params.text.trim().slice(0, 200),
          model_id: model,
        }),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs request failed (${response.status})`);
    }

    const data = await response.arrayBuffer();
    return {
      data,
      mimeType: response.headers.get('Content-Type') || 'audio/mpeg',
    };
  }
}

export async function checkProxyHealth(
  proxyUrl: string = getProxyUrl()
): Promise<'reachable' | 'error' | 'unconfigured'> {
  const base = proxyUrl.trim().replace(/\/+$/, '');
  if (!base) return 'unconfigured';
  try {
    const res = await fetch(`${base}/health`, { method: 'GET' });
    return res.ok ? 'reachable' : 'error';
  } catch {
    return 'error';
  }
}

/**
 * Full playback chain:
 * 1. card.audioUrl (if present)
 * 2. IndexedDB ttsCache
 * 3. Active provider (ProxyTTSProvider or ElevenLabsBYOKProvider) -> writes to IndexedDB cache
 * 4. WebSpeech fallback on any error (toast notification, no crash, no retry loop)
 */
export async function playTTS(text: string, options: TTSOptions = {}): Promise<TTSPlaybackResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { usedProvider: 'none', fallbackUsed: false };
  }

  if (activeController) {
    activeController.abort();
  }
  const controller = new AbortController();
  activeController = controller;

  const signal = options.signal ?? controller.signal;
  const rate = options.rate ?? 1.0;
  const lang = options.lang || 'en-US';
  const voiceId = options.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
  const model = options.elevenLabsModel || 'eleven_multilingual_v2';
  const proxyUrl = options.proxyUrl ?? getProxyUrl();
  const provider: TTSProviderType = options.provider ?? (proxyUrl ? 'proxy' : 'webspeech');

  options.onStatusChange?.('loading');

  // 1. Card-attached audioUrl
  if (options.audioUrl?.trim()) {
    try {
      await playAudioSource(options.audioUrl.trim(), rate);
      options.onStatusChange?.('playing');
      return { usedProvider: 'card_audio', fallbackUsed: false };
    } catch {
      // Continue down fallback chain
    }
  }

  // If WebSpeech is explicitly chosen or no remote provider is configured
  if (provider === 'webspeech') {
    const ok = speakWithWebSpeech(trimmed, { ...options, lang, rate });
    options.onStatusChange?.(ok ? 'playing' : 'error');
    return {
      usedProvider: ok ? 'webspeech' : 'none',
      fallbackUsed: false,
      error: ok ? undefined : 'Web Speech API unavailable',
    };
  }

  const cacheKey = buildTTSCacheKey(trimmed, lang, voiceId, model);

  // 2. IndexedDB cache lookup
  try {
    const cached = await db.ttsCache.get(cacheKey);
    if (cached && cached.data) {
      if (signal.aborted) return { usedProvider: 'none', fallbackUsed: false };
      await playAudioBytes(cached.data, cached.mimeType, rate);
      options.onStatusChange?.('playing');
      return { usedProvider: 'idb_cache', fallbackUsed: false };
    }
  } catch {
    // Proceed to network provider if cache read fails
  }

  // 3. Remote provider (Proxy or ElevenLabs BYOK)
  try {
    let fetched: { data: ArrayBuffer; mimeType: string };
    if (provider === 'proxy') {
      const proxy = new ProxyTTSProvider(proxyUrl);
      fetched = await proxy.fetchAudio(
        { text: trimmed, lang, voiceId: options.elevenLabsVoiceId, model },
        signal
      );
    } else {
      const byok = new ElevenLabsBYOKProvider();
      fetched = await byok.fetchAudio(
        {
          text: trimmed,
          apiKey: options.elevenLabsApiKey || '',
          voiceId,
          model,
        },
        signal
      );
    }

    if (signal.aborted) {
      options.onStatusChange?.('idle');
      return { usedProvider: 'none', fallbackUsed: false };
    }

    // Store in IndexedDB cache
    try {
      await db.ttsCache.put({
        key: cacheKey,
        mimeType: fetched.mimeType,
        data: fetched.data.slice(0),
        createdAt: Date.now(),
      });
    } catch {
      // Ignore cache quota errors
    }

    await playAudioBytes(fetched.data, fetched.mimeType, rate);
    options.onStatusChange?.('playing');
    return { usedProvider: provider, fallbackUsed: false };
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      options.onStatusChange?.('idle');
      return { usedProvider: 'none', fallbackUsed: false };
    }

    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      options.onStatusChange?.('idle');
      return { usedProvider: 'none', fallbackUsed: false };
    }

    const reason = err instanceof Error ? err.message : 'TTS proxy unavailable';
    useToastStore.getState().pushToast({
      title: 'Audio fallback',
      description: `${reason} — falling back to browser voice.`,
      variant: 'warning',
    });

    // 4. WebSpeech fallback (no retry loop)
    const fallbackOk = speakWithWebSpeech(trimmed, { ...options, lang, rate });
    options.onStatusChange?.(fallbackOk ? 'error' : 'error');
    return {
      usedProvider: fallbackOk ? 'webspeech' : 'none',
      fallbackUsed: true,
      error: reason,
    };
  }
}

export function debouncedPlayTTS(text: string, options: TTSOptions = {}, delayMs = 180): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (activeController) {
    activeController.abort();
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void playTTS(text, options);
  }, delayMs);
}
