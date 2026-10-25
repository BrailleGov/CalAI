import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./remote', () => ({
  API_BASE: 'https://api.test',
  getDeviceToken: () => 'device-123'
}));

vi.mock('./sync', () => ({
  getSyncToken: () => 'token-456',
  registerDevice: vi.fn()
}));

import {
  maskPhone,
  normalizePhone,
  saveSmsPreferences,
  smsPreview,
  validatePhone
} from './sms';

describe('sms helpers', () => {
  it('normalizes common phone formats', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('555 123 4567')).toBe('5551234567');
  });

  it('requires a country-code-length number', () => {
    expect(validatePhone('1234567')).not.toBeNull();
    expect(validatePhone('+15551234567')).toBeNull();
  });

  it('masks saved numbers for display', () => {
    expect(maskPhone('+15551234567')).toBe('•••• 4567');
  });

  it('states that replies are not monitored', () => {
    expect(smsPreview('lunch')).toContain('Replies are not monitored');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the device id and bearer token on SMS requests', async () => {
    let headers: Record<string, string> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        headers = (init?.headers ?? {}) as Record<string, string>;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );

    await saveSmsPreferences({
      enabled: true,
      phone: '+1 (555) 123-4567',
      consent: true,
      reminders: {
        enabled: true,
        quietStart: '21:00',
        quietEnd: '07:00',
        items: [{ id: 'lunch', meal: 'lunch', time: '12:00', enabled: true }]
      },
      timezone: 'America/Toronto'
    });

    expect(headers['X-CalAI-Device']).toBe('device-123');
    expect(headers.Authorization).toBe('Bearer token-456');
  });
});
