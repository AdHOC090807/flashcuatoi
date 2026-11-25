import { describe, expect, it, vi } from 'vitest';
import { handleRequest, type Env } from './index';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ELEVENLABS_API_KEY: 'mock-secret-key-not-real',
    ALLOWED_ORIGINS: 'https://adhoc090807.github.io,http://localhost:5173',
    DEFAULT_VOICE_ID: '21m00Tcm4TlvDq8ikWAM',
    ALLOWED_MODELS: 'eleven_multilingual_v2,eleven_flash_v2_5',
    ALLOWED_VOICE_IDS: '21m00Tcm4TlvDq8ikWAM,EXAVITQu4vr4xnSDxMaL',
    RATE_LIMIT_MAX: '5',
    RATE_LIMIT_WINDOW_SEC: '60',
    ...overrides,
  };
}

function makeMemoryCache(): Cache {
  const store = new Map<string, Response>();
  return {
    match: async (req: RequestInfo | URL) => {
      const key = typeof req === 'string' ? req : req instanceof URL ? req.href : req.url;
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    put: async (req: RequestInfo | URL, res: Response) => {
      const key = typeof req === 'string' ? req : req instanceof URL ? req.href : req.url;
      store.set(key, res.clone());
    },
    delete: async () => false,
    keys: async () => [],
    add: async () => {},
    addAll: async () => {},
  } as unknown as Cache;
}

function makeCtx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      },
    },
    flush: async () => {
      await Promise.all(pending);
    },
  };
}

describe('Cloudflare Worker TTS proxy', () => {
  it('allows configured origins and rejects blocked origins with 403', async () => {
    const env = makeEnv();
    const { ctx } = makeCtx();

    const blockedReq = new Request('https://worker.test/tts', {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', lang: 'en-US' }),
    });
    const blockedRes = await handleRequest(blockedReq, env, ctx, {
      cache: makeMemoryCache(),
      rateStore: new Map(),
      fetchFn: vi.fn(),
    });
    expect(blockedRes.status).toBe(403);
    const blockedJson = (await blockedRes.json()) as { code: string };
    expect(blockedJson.code).toBe('FORBIDDEN_ORIGIN');

    const preflightReq = new Request('https://worker.test/tts', {
      method: 'OPTIONS',
      headers: { Origin: 'https://adhoc090807.github.io' },
    });
    const preflightRes = await handleRequest(preflightReq, env, ctx);
    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://adhoc090807.github.io'
    );
  });

  it('caches audio/mpeg responses by text+voice+model+lang (MISS then HIT)', async () => {
    const env = makeEnv();
    const cache = makeMemoryCache();
    const rateStore = new Map<string, number[]>();
    const mockBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(mockBytes, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    );

    const req1 = new Request('https://worker.test/tts', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '1.2.3.4',
      },
      body: JSON.stringify({ text: 'たべる', lang: 'ja-JP' }),
    });
    const { ctx: ctx1, flush: flush1 } = makeCtx();
    const res1 = await handleRequest(req1, env, ctx1, { cache, fetchFn, rateStore });
    await flush1();

    expect(res1.status).toBe(200);
    expect(res1.headers.get('x-cache')).toBe('MISS');
    expect(res1.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const req2 = new Request('https://worker.test/tts', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '1.2.3.4',
      },
      body: JSON.stringify({ text: 'たべる', lang: 'ja-JP' }),
    });
    const { ctx: ctx2 } = makeCtx();
    const res2 = await handleRequest(req2, env, ctx2, { cache, fetchFn, rateStore });

    expect(res2.status).toBe(200);
    expect(res2.headers.get('x-cache')).toBe('HIT');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('validates empty text, >200 chars, invalid JSON, and allowlists', async () => {
    const env = makeEnv();
    const cache = makeMemoryCache();
    const rateStore = new Map<string, number[]>();
    const { ctx } = makeCtx();

    const makePost = (rawBody: string) =>
      new Request('https://worker.test/tts', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
        body: rawBody,
      });

    const badJson = await handleRequest(makePost('{bad'), env, ctx, { cache, rateStore });
    expect(badJson.status).toBe(400);

    const emptyText = await handleRequest(makePost(JSON.stringify({ text: '   ' })), env, ctx, {
      cache,
      rateStore,
    });
    expect(emptyText.status).toBe(400);

    const tooLong = await handleRequest(
      makePost(JSON.stringify({ text: 'a'.repeat(201) })),
      env,
      ctx,
      { cache, rateStore }
    );
    expect(tooLong.status).toBe(400);

    const badModel = await handleRequest(
      makePost(JSON.stringify({ text: 'hi', model: 'unknown_model' })),
      env,
      ctx,
      { cache, rateStore }
    );
    expect(badModel.status).toBe(400);

    const badVoice = await handleRequest(
      makePost(JSON.stringify({ text: 'hi', voiceId: 'unauthorized_voice' })),
      env,
      ctx,
      { cache, rateStore }
    );
    expect(badVoice.status).toBe(400);
  });

  it('maps upstream 401/402/429/5xx cleanly without leaking upstream body or secrets', async () => {
    const env = makeEnv();
    const cache = makeMemoryCache();
    const rateStore = new Map<string, number[]>();
    const { ctx } = makeCtx();

    for (const [upstreamStatus, expectedStatus, expectedCode] of [
      [401, 401, 'UPSTREAM_AUTH_ERROR'],
      [402, 402, 'UPSTREAM_PAYMENT_REQUIRED'],
      [429, 429, 'UPSTREAM_RATE_LIMITED'],
      [503, 502, 'UPSTREAM_SERVER_ERROR'],
    ] as const) {
      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Response('SECRET_UPSTREAM_DETAILS_123', { status: upstreamStatus }));

      const req = new Request('https://worker.test/tts', {
        method: 'POST',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `word-${upstreamStatus}`, lang: 'en-US' }),
      });

      const res = await handleRequest(req, env, ctx, { cache, fetchFn, rateStore });
      expect(res.status).toBe(expectedStatus);
      const bodyText = await res.text();
      expect(bodyText).not.toContain('SECRET_UPSTREAM_DETAILS_123');
      expect(bodyText).not.toContain(env.ELEVENLABS_API_KEY);
      expect(JSON.parse(bodyText).code).toBe(expectedCode);
    }
  });

  it('enforces per-IP rate limiting', async () => {
    const env = makeEnv({ RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_SEC: '60' });
    const cache = makeMemoryCache();
    const rateStore = new Map<string, number[]>();
    const fetchFn = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(new Uint8Array([9]).buffer, { status: 200 }))
      );

    for (let i = 0; i < 3; i++) {
      const { ctx } = makeCtx();
      const req = new Request('https://worker.test/tts', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '9.9.9.9',
        },
        body: JSON.stringify({ text: `item-${i}`, lang: 'en-US' }),
      });
      const res = await handleRequest(req, env, ctx, { cache, fetchFn, rateStore });
      if (i < 2) {
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(429);
      }
    }
  });
});
