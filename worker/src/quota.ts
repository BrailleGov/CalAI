import { ensureSchema } from './db';
import type { Env } from './types';

const MEMORY = new Map<string, number>();

function memoryConsume(key: string, limit: number): boolean {
  if (MEMORY.size > 5000) MEMORY.clear();
  const next = (MEMORY.get(key) ?? 0) + 1;
  MEMORY.set(key, next);
  return next <= limit;
}

/**
 * Increments a counter and returns whether the request is within `limit`.
 * KV is preferred, then D1, then isolate memory (best effort for local dev).
 */
export async function consumeQuota(
  env: Env,
  key: string,
  limit: number
): Promise<boolean> {
  if (!Number.isFinite(limit) || limit <= 0) return false;

  if (env.CALAI_CACHE) {
    try {
      const raw = await env.CALAI_CACHE.get(key);
      const next = (raw ? Number(raw) || 0 : 0) + 1;
      if (next > limit) return false;
      await env.CALAI_CACHE.put(key, String(next), { expirationTtl: 35 * 24 * 60 * 60 });
      return true;
    } catch {
      // Fall through to D1 or memory.
    }
  }

  if (env.DB) {
    try {
      await ensureSchema(env);
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO rate_limits (key, count, updated_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`
      )
        .bind(key, now)
        .run();
      const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?')
        .bind(key)
        .first<{ count: number }>();
      return (row?.count ?? 1) <= limit;
    } catch {
      // Fall through to memory.
    }
  }

  return memoryConsume(key, limit);
}

export function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}
