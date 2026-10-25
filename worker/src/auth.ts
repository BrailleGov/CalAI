import { ensureSchema } from './db';
import { constantTimeEqual, randomToken, sha256Hex } from './crypto';
import { consumeQuota, dayKey } from './quota';
import type { Env } from './types';

const DEVICE_ID = /^[A-Za-z0-9_-]{8,80}$/;

export type AuthResult =
  | { ok: true; deviceId: string }
  | { ok: false; status: number; error: string };

export function isValidDeviceId(value: string): boolean {
  return DEVICE_ID.test(value);
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? '';
}

export async function registerDevice(
  env: Env,
  request: Request,
  deviceId: string
): Promise<{ token: string } | { error: string; status: number }> {
  if (!env.DB) return { error: 'Cloud storage is not configured.', status: 503 };
  if (!isValidDeviceId(deviceId)) {
    return { error: 'Invalid device identifier.', status: 400 };
  }

  await ensureSchema(env);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await consumeQuota(env, `register:${dayKey()}:${ip}`, 10))) {
    return { error: 'Too many registration attempts today.', status: 429 };
  }

  const existing = await env.DB.prepare('SELECT id FROM devices WHERE id = ?')
    .bind(deviceId)
    .first<{ id: string }>();
  if (existing) {
    return { error: 'This device is already registered.', status: 409 };
  }

  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const now = Date.now();
  try {
    await env.DB.prepare(
      'INSERT INTO devices (id, secret_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)'
    )
      .bind(deviceId, hash, now, now)
      .run();
  } catch {
    return { error: 'This device is already registered.', status: 409 };
  }

  return { token };
}

export async function authenticateDevice(
  env: Env,
  request: Request
): Promise<AuthResult> {
  if (!env.DB) return { ok: false, status: 503, error: 'Cloud storage is not configured.' };

  const deviceId = (request.headers.get('X-CalAI-Device') ?? '').trim();
  const token = bearerToken(request);
  if (!isValidDeviceId(deviceId) || !token) {
    return { ok: false, status: 401, error: 'Device authorisation required.' };
  }

  await ensureSchema(env);
  const row = await env.DB.prepare(
    'SELECT id, secret_hash FROM devices WHERE id = ?'
  )
    .bind(deviceId)
    .first<{ id: string; secret_hash: string }>();

  if (!row) return { ok: false, status: 401, error: 'Device authorisation required.' };

  const hash = await sha256Hex(token);
  if (!constantTimeEqual(hash, row.secret_hash)) {
    return { ok: false, status: 401, error: 'Device authorisation required.' };
  }

  await env.DB.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?')
    .bind(Date.now(), deviceId)
    .run();

  return { ok: true, deviceId };
}
