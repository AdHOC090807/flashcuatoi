export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ELEVENLABS_API_KEY: string;
  ALLOWED_ORIGINS: string;
  DEFAULT_VOICE_ID: string;
  ALLOWED_MODELS?: string;
  ALLOWED_VOICE_IDS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  TTS_RATE_LIMITER?: RateLimitBinding;
}

export interface TTSRequestPayload {
  text?: unknown;
  lang?: unknown;
  voiceId?: unknown;
  model?: unknown;
}

export interface WorkerDeps {
  fetchFn?: typeof fetch;
  cache?: Cache;
  rateStore?: Map<string, number[]>;
}

const DEFAULT_MODEL = 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 200;
const DEFAULT_ALLOWED_MODELS = ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'];
const DEFAULT_ALLOWED_VOICES = [
  '21m00Tcm4TlvDq8ikWAM',
  'EXAVITQu4vr4xnSDxMaL',
  'ErXwobaYiN019PkySvjV',
  'AZnzlk1XvdvUeBnXmlld',
];

const memoryRateStore = new Map<string, number[]>();

function parseCsvList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'x-cache',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonError(
  status: number,
  error: string,
  code: string,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function checkRateLimit(
  ip: string,
  env: Env,
  store: Map<string, number[]>
): Promise<boolean> {
  if (env.TTS_RATE_LIMITER) {
    const res = await env.TTS_RATE_LIMITER.limit({ key: ip });
    return res.success;
  }

  const maxReq = Math.max(1, Number(env.RATE_LIMIT_MAX || '30') || 30);
  const windowMs = Math.max(1000, (Number(env.RATE_LIMIT_WINDOW_SEC || '60') || 60) * 1000);
  const now = Date.now();
  const timestamps = (store.get(ip) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxReq) {
    store.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  store.set(ip, timestamps);
  return true;
}

function mapUpstreamError(status: number, corsHeaders: Record<string, string>): Response {
  if (status === 401 || status === 403) {
    return jsonError(401, 'Upstream TTS authentication failed', 'UPSTREAM_AUTH_ERROR', corsHeaders);
  }
  if (status === 402) {
    return jsonError(
      402,
      'Upstream TTS quota or billing limit reached',
      'UPSTREAM_PAYMENT_REQUIRED',
      corsHeaders
    );
  }
  if (status === 429) {
    return jsonError(429, 'Upstream TTS rate limit exceeded', 'UPSTREAM_RATE_LIMITED', corsHeaders);
  }
  if (status >= 500) {
    return jsonError(502, 'Upstream TTS service unavailable', 'UPSTREAM_SERVER_ERROR', corsHeaders);
  }
  return jsonError(502, 'Upstream TTS request failed', 'UPSTREAM_ERROR', corsHeaders);
}

function getDefaultCache(): Cache | undefined {
  if (typeof caches !== 'undefined' && 'default' in caches) {
    return (caches as unknown as { default: Cache }).default;
  }
  return undefined;
}

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  deps: WorkerDeps = {}
): Promise<Response> {
  const url = new URL(request.url);
  const allowedOrigins = parseCsvList(env.ALLOWED_ORIGINS, []).map((o) => o.toLowerCase());
  const origin = request.headers.get('Origin');
  const originAllowed = !origin || allowedOrigins.includes(origin.toLowerCase());
  const corsHeaders = buildCorsHeaders(origin && originAllowed ? origin : null);

  if (!originAllowed) {
    return jsonError(403, 'Origin is not allowed', 'FORBIDDEN_ORIGIN', {});
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    return new Response(JSON.stringify({ ok: true, service: 'lexicards-tts-proxy' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  if (request.method !== 'POST' || url.pathname !== '/tts') {
    return jsonError(404, 'Not found', 'NOT_FOUND', corsHeaders);
  }

  if (!env.ELEVENLABS_API_KEY) {
    return jsonError(500, 'TTS proxy API key is not configured', 'MISSING_API_KEY', corsHeaders);
  }

  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';

  const rateStore = deps.rateStore ?? memoryRateStore;
  const allowedByRate = await checkRateLimit(clientIp, env, rateStore);
  if (!allowedByRate) {
    return jsonError(429, 'Too many requests', 'RATE_LIMITED', corsHeaders, {
      'Retry-After': env.RATE_LIMIT_WINDOW_SEC || '60',
    });
  }

  let body: TTSRequestPayload;
  try {
    body = (await request.json()) as TTSRequestPayload;
  } catch {
    return jsonError(400, 'Invalid JSON body', 'INVALID_JSON', corsHeaders);
  }

  if (!body || typeof body !== 'object') {
    return jsonError(400, 'JSON payload must be an object', 'INVALID_BODY', corsHeaders);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return jsonError(400, 'Text must not be empty', 'EMPTY_TEXT', corsHeaders);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return jsonError(
      400,
      `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
      'TEXT_TOO_LONG',
      corsHeaders
    );
  }

  const lang = typeof body.lang === 'string' && body.lang.trim() ? body.lang.trim() : 'en-US';
  const model =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL;
  const voiceId =
    typeof body.voiceId === 'string' && body.voiceId.trim()
      ? body.voiceId.trim()
      : env.DEFAULT_VOICE_ID;

  const allowedModels = parseCsvList(env.ALLOWED_MODELS, DEFAULT_ALLOWED_MODELS);
  if (!allowedModels.includes(model)) {
    return jsonError(400, 'Model is not in allowlist', 'DISALLOWED_MODEL', corsHeaders);
  }

  const allowedVoices = parseCsvList(env.ALLOWED_VOICE_IDS, DEFAULT_ALLOWED_VOICES);
  if (!voiceId || !allowedVoices.includes(voiceId)) {
    return jsonError(400, 'Voice ID is not in allowlist', 'DISALLOWED_VOICE', corsHeaders);
  }

  const cache = deps.cache ?? getDefaultCache();
  const cacheHash = await sha256Hex(`${text}::${voiceId}::${model}::${lang}`);
  const cacheKey = new Request(`https://tts-cache.lexicards.internal/v1/${cacheHash}.mp3`);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const audioBytes = await cached.arrayBuffer();
      return new Response(audioBytes, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'x-cache': 'HIT',
          ...corsHeaders,
        },
      });
    }
  }

  const fetchFn = deps.fetchFn ?? fetch;
  let upstream: Response;
  try {
    upstream = await fetchFn(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );
  } catch {
    return jsonError(
      502,
      'Failed to reach upstream TTS service',
      'UPSTREAM_NETWORK_ERROR',
      corsHeaders
    );
  }

  if (!upstream.ok) {
    return mapUpstreamError(upstream.status, corsHeaders);
  }

  const audioBuffer = await upstream.arrayBuffer();
  const cacheableResponse = new Response(audioBuffer.slice(0), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });

  if (cache) {
    ctx.waitUntil(cache.put(cacheKey, cacheableResponse));
  }

  return new Response(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-cache': 'MISS',
      ...corsHeaders,
    },
  });
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};
