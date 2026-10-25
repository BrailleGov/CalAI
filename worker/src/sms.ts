import { decryptText, encryptText } from './crypto';
import { ensureSchema } from './db';
import { consumeQuota, dayKey } from './quota';
import type { Env, Meal, SmsRow, StoredReminder } from './types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?\d{8,15}$/;
const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snacks'
};

export class SmsServiceError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SmsServiceError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseReminders(value: unknown): StoredReminder[] | null {
  if (!Array.isArray(value)) return null;
  const output: StoredReminder[] = [];
  for (const raw of value.slice(0, 12)) {
    if (!isRecord(raw)) return null;
    const id = text(raw.id, 40);
    const meal = raw.meal;
    const time = text(raw.time, 5);
    if (!id || !MEALS.includes(meal as Meal) || !TIME.test(time)) return null;
    output.push({ id, meal: meal as Meal, time });
  }
  return output;
}

function normalizePhone(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  const plus = cleaned.startsWith('+');
  return `${plus ? '+' : ''}${cleaned.replace(/\D/g, '')}`;
}

function validTimezone(value: string): boolean {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function encryptionKey(env: Env): string {
  if (!env.DATA_ENC_KEY) {
    throw new SmsServiceError('SMS encryption is not configured.', 503);
  }
  return env.DATA_ENC_KEY;
}

export async function saveSmsPrefs(
  env: Env,
  deviceId: string,
  body: unknown
): Promise<void> {
  if (!env.DB) throw new SmsServiceError('SMS is not configured.', 503);
  if (!isRecord(body)) throw new SmsServiceError('Invalid SMS preferences.', 400);

  const enabled = body.enabled === true;
  const consent = body.consent === true;
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
  const timezone = text(body.timezone, 80);
  const quietStart = text(body.quietStart, 5) || '21:00';
  const quietEnd = text(body.quietEnd, 5) || '07:00';
  const reminders = parseReminders(body.reminders);

  if (enabled && !consent) {
    throw new SmsServiceError('Consent is required before enabling SMS.', 400);
  }
  if (enabled && !PHONE.test(phone)) {
    throw new SmsServiceError('Enter a valid phone number with a country code.', 400);
  }
  if (enabled && (!reminders || reminders.length === 0)) {
    throw new SmsServiceError('Enable at least one reminder before turning on SMS.', 400);
  }
  if (!validTimezone(timezone)) {
    throw new SmsServiceError('A valid timezone is required.', 400);
  }
  if (!TIME.test(quietStart) || !TIME.test(quietEnd)) {
    throw new SmsServiceError('Quiet hours must be valid times.', 400);
  }

  await ensureSchema(env);

  if (!enabled || !consent) {
    await env.DB.prepare('DELETE FROM sms_prefs WHERE device_id = ?')
      .bind(deviceId)
      .run();
    return;
  }

  const key = encryptionKey(env);
  const encrypted = await encryptText(phone, key);
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO sms_prefs (
      device_id, phone_cipher, phone_iv, enabled, consent_at, timezone,
      quiet_start, quiet_end, reminders_json, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      phone_cipher = excluded.phone_cipher,
      phone_iv = excluded.phone_iv,
      enabled = excluded.enabled,
      consent_at = excluded.consent_at,
      timezone = excluded.timezone,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      reminders_json = excluded.reminders_json,
      updated_at = excluded.updated_at`
  )
    .bind(
      deviceId,
      encrypted.ciphertext,
      encrypted.iv,
      now,
      timezone,
      quietStart,
      quietEnd,
      JSON.stringify(reminders),
      now
    )
    .run();
}

export async function deleteSmsPrefs(env: Env, deviceId: string): Promise<void> {
  if (!env.DB) throw new SmsServiceError('SMS is not configured.', 503);
  await ensureSchema(env);
  await env.DB.prepare('DELETE FROM sms_prefs WHERE device_id = ?')
    .bind(deviceId)
    .run();
}

export async function sendTextbelt(
  env: Env,
  phone: string,
  message: string
): Promise<{ quotaRemaining?: number; textId?: number }> {
  if (!env.TEXTBELT_API_KEY) {
    throw new SmsServiceError('SMS is not configured.', 503);
  }
  if (!PHONE.test(phone)) {
    throw new SmsServiceError('Invalid phone number.', 400);
  }
  if (message.length > 320) {
    throw new SmsServiceError('Message is too long.', 400);
  }

  const base = (env.TEXTBELT_BASE_URL || 'https://textbelt.com').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${base}/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        phone,
        message,
        key: env.TEXTBELT_API_KEY
      }),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!isRecord(payload) || payload.success !== true) {
      const error =
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error.slice(0, 160)
          : 'SMS could not be sent.';
      throw new SmsServiceError(error, response.status === 402 ? 429 : 502);
    }

    return {
      ...(typeof payload.quotaRemaining === 'number'
        ? { quotaRemaining: payload.quotaRemaining }
        : {}),
      ...(typeof payload.textId === 'number' ? { textId: payload.textId } : {})
    };
  } catch (error) {
    if (error instanceof SmsServiceError) throw error;
    throw new SmsServiceError('SMS could not be sent.', 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTestSms(
  env: Env,
  deviceId: string
): Promise<{ quotaRemaining?: number }> {
  if (!env.DB) throw new SmsServiceError('SMS is not configured.', 503);
  await ensureSchema(env);

  const row = await env.DB.prepare(
    'SELECT * FROM sms_prefs WHERE device_id = ? AND enabled = 1 AND consent_at IS NOT NULL'
  )
    .bind(deviceId)
    .first<SmsRow>();
  if (!row) throw new SmsServiceError('Save SMS consent and a phone number first.', 400);

  if (!(await consumeQuota(env, `sms:test:${dayKey()}:${deviceId}`, 1))) {
    throw new SmsServiceError('A test text was already sent today.', 429);
  }

  const key = encryptionKey(env);
  const phone = await decryptText(row.phone_cipher, row.phone_iv, key);
  return sendTextbelt(
    env,
    phone,
    'CalAI test: SMS reminders are connected. Replies are not monitored.'
  );
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function localParts(date: Date, timeZone: string): { minutes: number; day: string } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date);

    const get = (type: string) => parts.find((part) => part.type === type)?.value;
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    const year = get('year');
    const month = get('month');
    const day = get('day');
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      !year ||
      !month ||
      !day
    ) {
      return null;
    }

    return {
      minutes: (hour % 24) * 60 + minute,
      day: `${year}-${month}-${day}`
    };
  } catch {
    return null;
  }
}

function inQuietHours(now: number, startTime: string, endTime: string): boolean {
  const start = minutes(startTime);
  const end = minutes(endTime);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export async function sendDueSms(
  env: Env,
  nowMs: number
): Promise<{ sent: number; failed: number }> {
  if (!env.DB || !env.TEXTBELT_API_KEY || !env.DATA_ENC_KEY) {
    return { sent: 0, failed: 0 };
  }

  await ensureSchema(env);
  const key = env.DATA_ENC_KEY;
  const now = new Date(nowMs);
  const rows = await env.DB.prepare(
    'SELECT * FROM sms_prefs WHERE enabled = 1 AND consent_at IS NOT NULL LIMIT 500'
  ).all<SmsRow>();

  let sent = 0;
  let failed = 0;
  let quotaExhausted = false;

  for (const row of rows.results ?? []) {
    if (quotaExhausted) break;

    const local = localParts(now, row.timezone);
    if (!local) continue;
    if (inQuietHours(local.minutes, row.quiet_start, row.quiet_end)) continue;

    let reminders: StoredReminder[] | null = null;
    try {
      reminders = parseReminders(JSON.parse(row.reminders_json));
    } catch {
      reminders = null;
    }
    if (!reminders) continue;

    const due = reminders.filter((reminder) => {
      const delta = local.minutes - minutes(reminder.time);
      return delta >= 0 && delta < 8;
    });

    for (const reminder of due) {
      const sentToday = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM sms_log WHERE device_id = ? AND day = ?'
      )
        .bind(row.device_id, local.day)
        .first<{ count: number }>();
      if ((sentToday?.count ?? 0) >= 4) break;

      const inserted = await env.DB.prepare(
        `INSERT OR IGNORE INTO sms_log (device_id, reminder_id, day, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`
      )
        .bind(row.device_id, reminder.id, local.day, Date.now())
        .run();

      if ((inserted.meta?.changes ?? 0) === 0) continue;

      try {
        const phone = await decryptText(row.phone_cipher, row.phone_iv, key);
        await sendTextbelt(
          env,
          phone,
          `CalAI: time to log ${MEAL_LABEL[reminder.meal]}. Replies are not monitored.`
        );
        await env.DB.prepare(
          'UPDATE sms_log SET status = ? WHERE device_id = ? AND reminder_id = ? AND day = ?'
        )
          .bind('sent', row.device_id, reminder.id, local.day)
          .run();
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('quota')) quotaExhausted = true;
        await env.DB.prepare(
          'UPDATE sms_log SET status = ? WHERE device_id = ? AND reminder_id = ? AND day = ?'
        )
          .bind('failed', row.device_id, reminder.id, local.day)
          .run();
      }
    }
  }

  await env.DB.prepare('DELETE FROM sms_log WHERE created_at < ?')
    .bind(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .run();

  return { sent, failed };
}
