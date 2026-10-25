import { decryptJson, encryptJson } from './crypto';
import { ensureSchema } from './db';
import type { Env, SyncRow } from './types';

const MAX_SNAPSHOT_CHARS = 1_000_000;

export class SyncError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

function encryptionKey(env: Env): string {
  if (!env.DATA_ENC_KEY) {
    throw new SyncError('Cloud storage encryption is not configured.', 503);
  }
  return env.DATA_ENC_KEY;
}

export async function saveSnapshot(
  env: Env,
  deviceId: string,
  body: unknown
): Promise<{ updatedAt: number }> {
  if (!env.DB) throw new SyncError('Cloud storage is not configured.', 503);
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new SyncError('Snapshot data is required.', 400);
  }

  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') {
    throw new SyncError('Snapshot data is invalid.', 400);
  }

  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_SNAPSHOT_CHARS) {
    throw new SyncError('That snapshot is too large.', 413);
  }

  const key = encryptionKey(env);
  const encrypted = await encryptJson(data, key);
  const updatedAt = Date.now();
  await ensureSchema(env);

  await env.DB.prepare(
    `INSERT INTO sync_snapshots (device_id, ciphertext, iv, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       updated_at = excluded.updated_at`
  )
    .bind(deviceId, encrypted.ciphertext, encrypted.iv, updatedAt)
    .run();

  return { updatedAt };
}

export async function loadSnapshot(
  env: Env,
  deviceId: string
): Promise<{ data: unknown; updatedAt: number } | null> {
  if (!env.DB) throw new SyncError('Cloud storage is not configured.', 503);
  const key = encryptionKey(env);
  await ensureSchema(env);

  const row = await env.DB.prepare(
    'SELECT device_id, ciphertext, iv, updated_at FROM sync_snapshots WHERE device_id = ?'
  )
    .bind(deviceId)
    .first<SyncRow>();

  if (!row) return null;

  try {
    const data = await decryptJson<unknown>(row.ciphertext, row.iv, key);
    return { data, updatedAt: row.updated_at };
  } catch {
    throw new SyncError('The stored snapshot could not be read.', 500);
  }
}

export async function deleteSnapshot(env: Env, deviceId: string): Promise<void> {
  if (!env.DB) throw new SyncError('Cloud storage is not configured.', 503);
  await ensureSchema(env);
  await env.DB.prepare('DELETE FROM sync_snapshots WHERE device_id = ?')
    .bind(deviceId)
    .run();
}
