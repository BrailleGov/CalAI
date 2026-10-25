import type { Reminder, ReminderSettings } from '../types';
import { API_BASE } from './remote';
import { getSyncToken, registerDevice } from './sync';

export const SMS_CONFIGURED = Boolean(API_BASE);

export class SmsError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'SmsError';
    this.status = status;
  }
}

export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  const plus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');
  return `${plus ? '+' : ''}${digits}`;
}

export function validatePhone(value: string): string | null {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return 'Enter a phone number with a country code (8–15 digits).';
  }
  return null;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  return `•••• ${digits.slice(-4)}`;
}

export function smsPreview(mealLabel = 'lunch'): string {
  return `CalAI: time to log ${mealLabel}. Replies are not monitored.`;
}

async function authorizedFetch(
  path: string,
  init: RequestInit
): Promise<Response> {
  if (!SMS_CONFIGURED) {
    throw new SmsError(
      'SMS needs the CalAI service. Deploy the Worker and set VITE_API_BASE.',
      503
    );
  }

  let token = getSyncToken();
  if (!token) token = await registerDevice();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  }).catch(() => null);

  if (!response) throw new SmsError('SMS needs a connection.');
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : response.status === 429
          ? 'SMS limit reached. Try again later.'
          : 'SMS could not be sent.';
    throw new SmsError(message, response.status);
  }
  return response;
}

export async function saveSmsPreferences(input: {
  enabled: boolean;
  phone: string;
  consent: boolean;
  reminders: ReminderSettings;
  timezone: string;
}): Promise<void> {
  const phone = normalizePhone(input.phone);
  const error = validatePhone(phone);
  if (error) throw new SmsError(error, 400);
  if (input.enabled && !input.consent) {
    throw new SmsError('Confirm that CalAI may send you reminder texts.', 400);
  }

  const reminders: Reminder[] = input.reminders.items.filter((item) => item.enabled);
  await authorizedFetch('/v1/sms/prefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled: input.enabled,
      phone,
      consent: input.consent,
      timezone: input.timezone,
      quietStart: input.reminders.quietStart,
      quietEnd: input.reminders.quietEnd,
      reminders
    })
  });
}

export async function sendTestSms(): Promise<{ quotaRemaining?: number }> {
  const response = await authorizedFetch('/v1/sms/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  return payload && typeof payload === 'object'
    ? { quotaRemaining: (payload as { quotaRemaining?: number }).quotaRemaining }
    : {};
}

export async function disableSms(): Promise<void> {
  await authorizedFetch('/v1/sms/prefs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
}
