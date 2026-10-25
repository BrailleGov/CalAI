import webpush from 'web-push';
import { authenticateDevice, registerDevice } from './auth';
import {
  AiError,
  analyzeMealImage,
  chatWithCoach,
  parseMealDescription,
  recipeIdea
} from './ai';
import {
  barcodeCacheKey,
  checkRateLimit,
  readCache,
  searchCacheKey,
  writeCache
} from './cache';
import { sha256Hex } from './crypto';
import { dedupeFoods, rankFoods } from './normalize';
import { lookupOffBarcode, searchOff } from './providers/off';
import { searchUsda } from './providers/usda';
import {
  SmsServiceError,
  deleteSmsPrefs,
  saveSmsPrefs,
  sendDueSms,
  sendTestSms
} from './sms';
import {
  SyncError,
  deleteSnapshot,
  loadSnapshot,
  saveSnapshot
} from './sync';
import type {
  Env,
  ExecutionContextLike,
  FoodDTO,
  Meal,
  PushRecord,
  StoredReminder
} from './types';

const DEFAULT_ORIGINS = [
  'https://braillegov.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173'
];

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function allowedOrigins(env: Env): string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured && configured.length > 0 ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(request: Request, env: Env): Record<string, string> | null {
  const origin = request.headers.get('Origin');
  const origins = allowedOrigins(env);
  if (origin && !origins.includes(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin ?? origins[0] ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CalAI-Device, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers
    }
  });
}

function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string>
): Response {
  return json({ error: message }, status, headers);
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

async function readJson(request: Request, maxChars = 100_000): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(length) && length > maxChars) {
    throw new HttpError('Request body is too large.', 413);
  }

  const raw = await request.text();
  if (raw.length > maxChars) {
    throw new HttpError('Request body is too large.', 413);
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError('Invalid JSON.', 400);
  }
}

function errorStatus(error: unknown): { message: string; status: number } | null {
  if (error instanceof HttpError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof AiError || error instanceof SyncError || error instanceof SmsServiceError) {
    return { message: error.message, status: error.status };
  }
  return null;
}

async function handleSearch(
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
  headers: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(
    30,
    Math.max(1, Number(url.searchParams.get('limit') ?? '20') || 20)
  );

  if (query.length < 2) {
    return errorResponse('Search for at least two characters.', 400, headers);
  }
  if (query.length > 120) {
    return errorResponse('That search is too long.', 400, headers);
  }

  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await checkRateLimit(env, ip))) {
    return errorResponse('Daily search limit reached. Try again tomorrow.', 429, headers);
  }

  const cacheKey = searchCacheKey(query, limit);
  const cached = await readCache<{ foods: FoodDTO[]; sources: string[] }>(
    env,
    cacheKey
  );
  if (cached) {
    return json(
      { foods: cached.foods, sources: cached.sources, cached: true },
      200,
      { ...headers, 'Cache-Control': 'public, max-age=300' }
    );
  }

  const providers: { source: string; promise: Promise<FoodDTO[]> }[] = [
    { source: 'off', promise: searchOff(query, limit) }
  ];
  if (env.USDA_API_KEY) {
    providers.push({
      source: 'usda',
      promise: searchUsda(query, limit, env.USDA_API_KEY)
    });
  }

  const settled = await Promise.allSettled(providers.map((item) => item.promise));
  const foods: FoodDTO[] = [];
  const sources: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      foods.push(...result.value);
      sources.push(providers[index]?.source ?? 'unknown');
    }
  });

  if (foods.length === 0 && sources.length === 0) {
    return errorResponse('Food search is unavailable right now.', 502, headers);
  }

  const payload = {
    foods: rankFoods(dedupeFoods(foods), query, limit),
    sources
  };

  ctx.waitUntil(writeCache(env, cacheKey, payload));
  return json({ ...payload, cached: false }, 200, {
    ...headers,
    'Cache-Control': 'public, max-age=300'
  });
}

async function handleBarcode(
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
  headers: Record<string, string>,
  code: string
): Promise<Response> {
  if (!/^\d{8,14}$/.test(code)) {
    return errorResponse('Enter an 8 to 14 digit barcode.', 400, headers);
  }

  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await checkRateLimit(env, ip))) {
    return errorResponse('Daily lookup limit reached. Try again tomorrow.', 429, headers);
  }

  const cacheKey = barcodeCacheKey(code);
  const cached = await readCache<{ foods: FoodDTO[] }>(env, cacheKey);
  if (cached) {
    return json(
      { foods: cached.foods, sources: ['off'], cached: true },
      200,
      { ...headers, 'Cache-Control': 'public, max-age=3600' }
    );
  }

  try {
    const food = await lookupOffBarcode(code);
    const payload = { foods: food ? [food] : [] };
    ctx.waitUntil(writeCache(env, cacheKey, payload));
    return json({ ...payload, sources: ['off'], cached: false }, 200, {
      ...headers,
      'Cache-Control': 'public, max-age=300'
    });
  } catch {
    return errorResponse('Barcode lookup is unavailable right now.', 502, headers);
  }
}

async function pushKey(endpoint: string): Promise<string> {
  return `push:${await sha256Hex(endpoint)}`;
}

function isPushRecord(value: unknown): value is PushRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PushRecord>;
  return (
    typeof record.endpoint === 'string' &&
    record.endpoint.startsWith('https://') &&
    Boolean(record.keys) &&
    typeof record.keys?.p256dh === 'string' &&
    typeof record.keys?.auth === 'string' &&
    typeof record.timezone === 'string' &&
    typeof record.quietStart === 'string' &&
    TIME.test(record.quietStart) &&
    typeof record.quietEnd === 'string' &&
    TIME.test(record.quietEnd) &&
    Array.isArray(record.reminders) &&
    record.reminders.length <= 12 &&
    record.reminders.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        MEALS.includes(item.meal) &&
        typeof item.time === 'string' &&
        TIME.test(item.time)
    )
  );
}

function parseReminders(value: unknown): StoredReminder[] | null {
  if (!Array.isArray(value)) return null;
  const output: StoredReminder[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const reminder = item as Partial<StoredReminder>;
    if (
      typeof reminder.id !== 'string' ||
      !MEALS.includes(reminder.meal as Meal) ||
      typeof reminder.time !== 'string' ||
      !TIME.test(reminder.time)
    ) {
      return null;
    }
    output.push({
      id: reminder.id.slice(0, 40),
      meal: reminder.meal as Meal,
      time: reminder.time
    });
  }
  return output;
}

async function handlePushSubscribe(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  if (!env.CALAI_CACHE || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return errorResponse('Push reminders are not configured.', 503, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON.', 400, headers);
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('Invalid subscription.', 400, headers);
  }

  const record = body as {
    subscription?: {
      endpoint?: string;
      expirationTime?: number | null;
      keys?: { p256dh?: string; auth?: string };
    };
    timezone?: string;
    reminders?: unknown;
    quietStart?: string;
    quietEnd?: string;
  };

  const endpoint = record.subscription?.endpoint ?? '';
  const p256dh = record.subscription?.keys?.p256dh ?? '';
  const auth = record.subscription?.keys?.auth ?? '';
  const timezone = record.timezone ?? '';
  const reminders = parseReminders(record.reminders);
  const quietStart = record.quietStart ?? '21:00';
  const quietEnd = record.quietEnd ?? '07:00';

  if (
    !endpoint.startsWith('https://') ||
    p256dh.length < 20 ||
    auth.length < 8 ||
    timezone.length === 0 ||
    timezone.length > 80 ||
    !TIME.test(quietStart) ||
    !TIME.test(quietEnd) ||
    !reminders
  ) {
    return errorResponse('Invalid subscription.', 400, headers);
  }

  const deviceId = (request.headers.get('X-CalAI-Device') ?? '').slice(0, 80);
  const key = await pushKey(endpoint);
  const deviceKey = deviceId ? `device:${deviceId}` : null;

  if (deviceKey) {
    const previousKey = await env.CALAI_CACHE.get(deviceKey);
    if (previousKey && previousKey !== key) {
      await env.CALAI_CACHE.delete(previousKey);
    }
    await env.CALAI_CACHE.put(deviceKey, key);
  }

  const stored: PushRecord = {
    endpoint,
    expirationTime: record.subscription?.expirationTime ?? null,
    keys: { p256dh, auth },
    timezone,
    reminders,
    quietStart,
    quietEnd,
    deviceId,
    updatedAt: Date.now()
  };

  await env.CALAI_CACHE.put(key, JSON.stringify(stored));
  return json({ ok: true }, 200, headers);
}

async function handlePushUnsubscribe(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  if (!env.CALAI_CACHE) {
    return errorResponse('Push reminders are not configured.', 503, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON.', 400, headers);
  }

  const endpoint =
    body && typeof body === 'object'
      ? ((body as { endpoint?: unknown }).endpoint as string | undefined)
      : undefined;

  if (!endpoint || !endpoint.startsWith('https://')) {
    return errorResponse('Invalid subscription.', 400, headers);
  }

  const key = await pushKey(endpoint);
  const raw = await env.CALAI_CACHE.get(key, 'json');
  if (isPushRecord(raw) && raw.deviceId) {
    await env.CALAI_CACHE.delete(`device:${raw.deviceId}`);
  }
  await env.CALAI_CACHE.delete(key);
  return json({ ok: true }, 200, headers);
}

async function handleRegister(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const deviceId = (request.headers.get('X-CalAI-Device') ?? '').trim();
  const result = await registerDevice(env, request, deviceId);
  if ('error' in result) return errorResponse(result.error, result.status, headers);
  return json({ token: result.token }, 200, headers);
}

async function handleSync(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const auth = await authenticateDevice(env, request);
  if (!auth.ok) return errorResponse(auth.error, auth.status, headers);

  if (request.method === 'GET') {
    const snapshot = await loadSnapshot(env, auth.deviceId);
    if (!snapshot) {
      return errorResponse('No cloud backup was found for this device.', 404, headers);
    }
    return json(snapshot, 200, headers);
  }

  if (request.method === 'PUT') {
    const body = await readJson(request, 1_200_000);
    const result = await saveSnapshot(env, auth.deviceId, body);
    return json({ ok: true, ...result }, 200, headers);
  }

  if (request.method === 'DELETE') {
    await deleteSnapshot(env, auth.deviceId);
    return json({ ok: true }, 200, headers);
  }

  return errorResponse('Method not allowed.', 405, headers);
}

async function handleAi(
  request: Request,
  env: Env,
  headers: Record<string, string>,
  kind: 'recognize' | 'parse' | 'chat' | 'recipes'
): Promise<Response> {
  const limit = kind === 'recognize' ? 8_600_000 : 80_000;
  const body = await readJson(request, limit);

  if (kind === 'recognize') {
    return json(await analyzeMealImage(env, request, body), 200, headers);
  }
  if (kind === 'parse') {
    return json(await parseMealDescription(env, request, body), 200, headers);
  }
  if (kind === 'chat') {
    return json(await chatWithCoach(env, request, body), 200, headers);
  }
  return json(await recipeIdea(env, request, body), 200, headers);
}

async function handleSms(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const auth = await authenticateDevice(env, request);
  if (!auth.ok) return errorResponse(auth.error, auth.status, headers);

  if (request.method === 'POST' && new URL(request.url).pathname === '/v1/sms/prefs') {
    const body = await readJson(request, 12_000);
    await saveSmsPrefs(env, auth.deviceId, body);
    return json({ ok: true }, 200, headers);
  }

  if (request.method === 'DELETE' && new URL(request.url).pathname === '/v1/sms/prefs') {
    await deleteSmsPrefs(env, auth.deviceId);
    return json({ ok: true }, 200, headers);
  }

  if (request.method === 'POST' && new URL(request.url).pathname === '/v1/sms/test') {
    const result = await sendTestSms(env, auth.deviceId);
    return json({ ok: true, ...result }, 200, headers);
  }

  return errorResponse('Method not allowed.', 405, headers);
}


export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContextLike
  ): Promise<Response> {
    const headers = corsHeaders(request, env);
    if (!headers) {
      return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(
          {
            ok: true,
            search: true,
            ai: Boolean(env.DEEPSEEK_API_KEY),
            sync: Boolean(env.DB && env.DATA_ENC_KEY),
            sms: Boolean(env.TEXTBELT_API_KEY && env.DB && env.DATA_ENC_KEY),
            push: Boolean(
              env.CALAI_CACHE && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
            )
          },
          200,
          headers
        );
      }

      if (request.method === 'GET' && url.pathname === '/v1/foods/search') {
        return await handleSearch(request, env, ctx, headers);
      }

      const barcodeMatch = /^\/v1\/foods\/barcode\/(\d{8,14})$/.exec(url.pathname);
      if (request.method === 'GET' && barcodeMatch?.[1]) {
        return await handleBarcode(request, env, ctx, headers, barcodeMatch[1]);
      }

      if (request.method === 'POST' && url.pathname === '/v1/push/subscribe') {
        return await handlePushSubscribe(request, env, headers);
      }

      if (request.method === 'POST' && url.pathname === '/v1/push/unsubscribe') {
        return await handlePushUnsubscribe(request, env, headers);
      }

      if (request.method === 'POST' && url.pathname === '/v1/auth/register') {
        return await handleRegister(request, env, headers);
      }

      if (
        url.pathname === '/v1/sync' &&
        (request.method === 'GET' ||
          request.method === 'PUT' ||
          request.method === 'DELETE')
      ) {
        return await handleSync(request, env, headers);
      }

      if (request.method === 'POST' && url.pathname === '/v1/ai/recognize') {
        return await handleAi(request, env, headers, 'recognize');
      }

      if (request.method === 'POST' && url.pathname === '/v1/ai/parse') {
        return await handleAi(request, env, headers, 'parse');
      }

      if (request.method === 'POST' && url.pathname === '/v1/ai/chat') {
        return await handleAi(request, env, headers, 'chat');
      }

      if (request.method === 'POST' && url.pathname === '/v1/ai/recipes') {
        return await handleAi(request, env, headers, 'recipes');
      }

      if (
        (request.method === 'POST' || request.method === 'DELETE') &&
        url.pathname === '/v1/sms/prefs'
      ) {
        return await handleSms(request, env, headers);
      }

      if (request.method === 'POST' && url.pathname === '/v1/sms/test') {
        return await handleSms(request, env, headers);
      }

      return errorResponse('Not found.', 404, headers);
    } catch (error) {
      const known = errorStatus(error);
      if (known) return errorResponse(known.message, known.status, headers);
      return errorResponse('Something went wrong.', 500, headers);
    }
  },

  async scheduled(
    event: { scheduledTime: number },
    env: Env,
    _ctx: ExecutionContextLike
  ): Promise<void> {
    if (
      env.CALAI_CACHE &&
      env.VAPID_PUBLIC_KEY &&
      env.VAPID_PRIVATE_KEY
    ) {
      webpush.setVapidDetails(
      env.VAPID_SUBJECT ?? 'mailto:calai@example.invalid',
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );

    let cursor: string | undefined;
    do {
      const page = await env.CALAI_CACHE.list({
        prefix: 'push:',
        cursor,
        limit: 100
      });

      for (const key of page.keys) {
        const raw = await env.CALAI_CACHE.get(key.name, 'json');
        if (!isPushRecord(raw)) continue;

        const now = new Date(event.scheduledTime);
        const due = dueReminders(raw, now);
        for (const reminder of due) {
          const sentKey = `sent:${key.name.slice(5)}:${now
            .toISOString()
            .slice(0, 10)}:${reminder.id}`;
          if (await env.CALAI_CACHE.get(sentKey)) continue;

          try {
            await webpush.sendNotification(
              {
                endpoint: raw.endpoint,
                expirationTime: raw.expirationTime,
                keys: raw.keys
              },
              JSON.stringify({
                title: 'CalAI',
                body: `Time to log ${reminder.meal}`,
                meal: reminder.meal,
                url: '/CalAI/#/today'
              }),
              { TTL: 3600, urgency: 'normal' }
            );
            await env.CALAI_CACHE.put(sentKey, '1', { expirationTtl: 20 * 60 * 60 });
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await env.CALAI_CACHE.delete(key.name);
              if (raw.deviceId) {
                await env.CALAI_CACHE.delete(`device:${raw.deviceId}`);
              }
              break;
            }
          }
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    }

    try {
      await sendDueSms(env, event.scheduledTime);
    } catch {
      // SMS is best effort. A failure is retried on the next five-minute tick.
    }
  }
};

function localMinutes(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function inQuietHours(now: number, startTime: string, endTime: string): boolean {
  const start = minutes(startTime);
  const end = minutes(endTime);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function dueReminders(record: PushRecord, now: Date): StoredReminder[] {
  const nowMinutes = localMinutes(now, record.timezone);
  if (
    nowMinutes === null ||
    inQuietHours(nowMinutes, record.quietStart, record.quietEnd)
  ) {
    return [];
  }

  return record.reminders.filter((reminder) => {
    const delta = nowMinutes - minutes(reminder.time);
    return delta >= 0 && delta < 8;
  });
}
