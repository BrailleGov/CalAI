import type { Env } from './types';

const SEARCH_TTL_SECONDS = 7 * 24 * 60 * 60;
const RATE_TTL_SECONDS = 24 * 60 * 60;

export async function readCache<T>(env: Env, key: string): Promise<T | null> {
  if (!env.CALAI_CACHE) return null;
  try {
    return (await env.CALAI_CACHE.get(key, 'json')) as T | null;
  } catch {
    return null;
  }
}

export async function writeCache(
  env: Env,
  key: string,
  value: unknown,
  ttl = SEARCH_TTL_SECONDS
): Promise<void> {
  if (!env.CALAI_CACHE) return;
  try {
    await env.CALAI_CACHE.put(key, JSON.stringify(value), {
      expirationTtl: ttl
    });
  } catch {
    // Cache writes are best effort; the response has already been produced.
  }
}

export function searchCacheKey(query: string, limit: number): string {
  return `search:${query.trim().toLowerCase()}:${limit}`;
}

export function barcodeCacheKey(code: string): string {
  return `barcode:${code}`;
}

export async function checkRateLimit(
  env: Env,
  ip: string | null
): Promise<boolean> {
  if (!env.CALAI_CACHE || !ip) return true;

  const limit = Math.max(
    20,
    Number(env.DAILY_SEARCH_LIMIT ?? '300') || 300
  );
  const day = new Date().toISOString().slice(0, 10);
  const key = `rate:${day}:${ip}`;

  try {
    const raw = await env.CALAI_CACHE.get(key);
    const count = raw ? Number(raw) || 0 : 0;
    if (count >= limit) return false;
    await env.CALAI_CACHE.put(key, String(count + 1), {
      expirationTtl: RATE_TTL_SECONDS
    });
    return true;
  } catch {
    return true;
  }
}
