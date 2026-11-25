import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, LexiCardsDatabase } from '@/db';
import { buildTTSCacheKey, checkProxyHealth, playTTS, ProxyTTSProvider } from '@/features/tts';
import { useToastStore } from '@/store/useToastStore';

describe('Frontend TTS proxy, IndexedDB cache & fallback', () => {
  beforeEach(async () => {
    await db.ttsCache.clear();
    useToastStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  it('fetches audio from ProxyTTSProvider, caches in IndexedDB, and hits cache on replay', async () => {
    const audioBytes = new Uint8Array([73, 68, 51, 3]).buffer;
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(audioBytes, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const playMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(() => ({
        play: playMock,
        pause: vi.fn(),
        removeAttribute: vi.fn(),
        preload: 'auto',
        playbackRate: 1,
        src: '',
      }))
    );
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-audio');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    const res1 = await playTTS('たべる', {
      lang: 'ja-JP',
      provider: 'proxy',
      proxyUrl: 'https://proxy.example.workers.dev',
    });
    expect(res1.usedProvider).toBe('proxy');
    expect(res1.fallbackUsed).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const cacheKey = buildTTSCacheKey(
      'たべる',
      'ja-JP',
      '21m00Tcm4TlvDq8ikWAM',
      'eleven_multilingual_v2'
    );
    const cached = await db.ttsCache.get(cacheKey);
    expect(cached).toBeDefined();

    // Second play should use IndexedDB cache without calling fetch again
    const res2 = await playTTS('たべる', {
      lang: 'ja-JP',
      provider: 'proxy',
      proxyUrl: 'https://proxy.example.workers.dev',
    });
    expect(res2.usedProvider).toBe('idb_cache');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to WebSpeech with toast notification on proxy error and does not retry', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Upstream rate limit' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const speakSpy = vi.fn();
    const cancelSpy = vi.fn();
    vi.stubGlobal('speechSynthesis', {
      speak: speakSpy,
      cancel: cancelSpy,
      getVoices: () => [],
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      vi.fn().mockImplementation((text: string) => ({ text, lang: '', rate: 1 }))
    );

    const res = await playTTS('resilient', {
      lang: 'en-US',
      provider: 'proxy',
      proxyUrl: 'https://proxy.example.workers.dev',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.fallbackUsed).toBe(true);
    expect(res.usedProvider).toBe('webspeech');
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
  });

  it('checks proxy health and rejects empty proxy URL cleanly', async () => {
    expect(await checkProxyHealth('')).toBe('unconfigured');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })));
    expect(await checkProxyHealth('https://proxy.example.workers.dev')).toBe('reachable');

    const provider = new ProxyTTSProvider('');
    await expect(provider.fetchAudio({ text: 'hello', lang: 'en-US' })).rejects.toThrow(
      /not configured/i
    );
  });

  it('upgrades Dexie v2 -> v3 preserving existing decks/cards and adding ttsCache', async () => {
    const dbName = `LexiCardsV3Migration_${Date.now()}`;
    const v2 = new Dexie(dbName);
    v2.version(2).stores({
      decks: 'id, name, language, createdAt, updatedAt, *tags',
      cards: 'id, deckId, term, status, dueDate, createdAt, lesson, *tags',
      reviewLogs: 'id, cardId, deckId, reviewedAt, mode',
      settings: 'id',
    });
    await v2.open();
    await v2.table('decks').put({
      id: 'd_v2',
      name: 'Existing JA Deck',
      description: '',
      color: '#ec4899',
      emoji: '🇯🇵',
      language: 'ja',
      tags: [],
      createdAt: 100,
      updatedAt: 100,
    });
    v2.close();

    const v3 = new LexiCardsDatabase(dbName);
    await v3.open();
    expect((await v3.decks.get('d_v2'))?.language).toBe('ja');
    await v3.ttsCache.put({
      key: 'k1',
      mimeType: 'audio/mpeg',
      data: new Uint8Array([1, 2]).buffer,
      createdAt: 500,
    });
    expect(await v3.ttsCache.get('k1')).toBeDefined();
    v3.close();
    await Dexie.delete(dbName);
  });
});
