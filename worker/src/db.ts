import type { D1DatabaseLike, Env } from './types';

const READY = new WeakMap<D1DatabaseLike, Promise<void>>();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    secret_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_snapshots (
    device_id TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sms_prefs (
    device_id TEXT PRIMARY KEY,
    phone_cipher TEXT NOT NULL,
    phone_iv TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    consent_at INTEGER,
    timezone TEXT NOT NULL,
    quiet_start TEXT NOT NULL,
    quiet_end TEXT NOT NULL,
    reminders_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    reminder_id TEXT NOT NULL,
    day TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (device_id, reminder_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS sms_log_created_idx ON sms_log (created_at)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`
];

export async function ensureSchema(env: Env): Promise<void> {
  if (!env.DB) throw new Error('Database is not configured');
  const existing = READY.get(env.DB);
  if (existing) return existing;

  const running = (async () => {
    for (const statement of STATEMENTS) {
      await env.DB!.prepare(statement).run();
    }
  })();

  READY.set(env.DB, running);
  try {
    await running;
  } catch (error) {
    READY.delete(env.DB);
    throw error;
  }
}
