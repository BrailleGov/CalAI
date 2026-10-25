import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmsServiceError, sendTextbelt } from './sms';
import type { Env } from './types';

describe('Textbelt request handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the documented form fields and never returns the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, quotaRemaining: 42, textId: 7 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = { TEXTBELT_API_KEY: 'secret-key' } as Env;
    const result = await sendTextbelt(env, '+15551234567', 'CalAI test. Replies are not monitored.');

    expect(result).toEqual({ quotaRemaining: 42, textId: 7 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://textbelt.com/text');
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('phone')).toBe('+15551234567');
    expect(body.get('key')).toBe('secret-key');
    expect(body.get('message')).toContain('Replies are not monitored');
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('surfaces provider failures without leaking the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'Out of quota' }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    await expect(
      sendTextbelt({ TEXTBELT_API_KEY: 'secret-key' } as Env, '+15551234567', 'hello')
    ).rejects.toMatchObject({ status: 429, message: 'Out of quota' });
  });

  it('rejects invalid phone numbers and missing configuration', async () => {
    await expect(
      sendTextbelt({ TEXTBELT_API_KEY: 'secret-key' } as Env, '123', 'hello')
    ).rejects.toBeInstanceOf(SmsServiceError);
    await expect(sendTextbelt({} as Env, '+15551234567', 'hello')).rejects.toMatchObject({
      status: 503
    });
  });
});
