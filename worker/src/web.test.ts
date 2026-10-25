import { afterEach, describe, expect, it, vi } from 'vitest';
import { refineItemsWithWeb, discoverFoods } from './ai';
import { searchWeb } from './web';
import type { Env } from './types';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

const bravePayload = {
  web: {
    results: [
      {
        title: '<b>Coca-Cola Zero</b> nutrition',
        url: 'https://www.example.com/coke-zero',
        description: 'Zero calories and <strong>zero sugar</strong>.',
        page_age: '2026-04-17T00:00:00'
      },
      {
        title: 'Duplicate',
        url: 'https://www.example.com/coke-zero',
        description: 'Duplicate URL should be removed.'
      },
      {
        title: 'Unsafe',
        url: 'javascript:alert(1)',
        description: 'This URL should be removed.'
      },
      {
        title: 'No description',
        url: 'https://example.org/no-description'
      },
      {
        title: 'Second valid result',
        url: 'https://example.org/second',
        description: 'A valid second result.'
      }
    ]
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Brave web search', () => {
  it('returns no results when the key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchWeb({} as Env, undefined, 'banana');
    expect(result.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sanitizes titles, descriptions, URLs, and duplicates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(bravePayload));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://worker.test/v1/foods/discover', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '127.0.0.10',
        'X-CalAI-Device': 'device-web-test'
      }
    });
    const result = await searchWeb(
      { BRAVE_SEARCH_API_KEY: 'brave-test' } as Env,
      request,
      'coke zero nutrition'
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      title: 'Coca-Cola Zero nutrition',
      url: 'https://www.example.com/coke-zero',
      domain: 'example.com',
      description: 'Zero calories and zero sugar.'
    });
    expect(result.results[1]?.url).toBe('https://example.org/second');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api.search.brave.com/res/v1/web/search'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Subscription-Token': 'brave-test'
        })
      })
    );
  });

  it('retries once after a rate limit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{}', { status: 429, headers: { 'Retry-After': '0.25' } })
      )
      .mockResolvedValueOnce(jsonResponse(bravePayload));
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '127.0.0.15' }
    });
    const result = await searchWeb(
      { BRAVE_SEARCH_API_KEY: 'brave-test' } as Env,
      request,
      'coke zero retry'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('fails closed on provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))
    );
    const request = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '127.0.0.11' }
    });
    const result = await searchWeb(
      { BRAVE_SEARCH_API_KEY: 'brave-test' } as Env,
      request,
      'banana'
    );
    expect(result.results).toEqual([]);
    expect(result.cached).toBe(false);
  });

  it('uses KV cache before calling Brave again', async () => {
    const store = new Map<string, string>();
    const cache = {
      async get(key: string, type?: 'json') {
        const raw = store.get(key) ?? null;
        return type === 'json' && raw ? (JSON.parse(raw) as unknown) : raw;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
      async list() {
        return { keys: [], list_complete: true };
      }
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(bravePayload));
    vi.stubGlobal('fetch', fetchMock);

    const env = {
      BRAVE_SEARCH_API_KEY: 'brave-test',
      CALAI_CACHE: cache
    } as unknown as Env;
    const request = new Request('https://worker.test/', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '127.0.0.12' }
    });

    const first = await searchWeb(env, request, 'coke zero');
    const second = await searchWeb(env, request, 'coke zero');

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refines branded items with web evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(bravePayload))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  updates: [
                    {
                      webQuery: 'Coca-Cola Zero 355 ml can',
                      kcal: 0,
                      protein: 0,
                      carbs: 0,
                      fat: 0,
                      confidence: 0.95,
                      notes: 'Contains sweeteners.'
                    }
                  ],
                  note: 'Matched the can size.'
                })
              },
              finish_reason: 'stop'
            }
          ],
          usage: { total_tokens: 30 }
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://worker.test/v1/ai/parse', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '127.0.0.13',
        'X-CalAI-Device': 'device-web-refine'
      }
    });
    const result = await refineItemsWithWeb(
      { DEEPSEEK_API_KEY: 'test', BRAVE_SEARCH_API_KEY: 'brave-test' } as Env,
      request,
      [
        {
          name: 'Coke Zero',
          grams: 355,
          quantityLabel: '1 can',
          kcal: 140,
          protein: 0,
          carbs: 35,
          fat: 0,
          confidence: 0.6,
          webQuery: 'Coca-Cola Zero 355 ml can'
        }
      ]
    );

    expect(result.items[0]).toMatchObject({
      kcal: 0,
      carbs: 0,
      confidence: 0.95,
      notes: 'Contains sweeteners.'
    });
    expect(result.webSources[0]?.domain).toBe('example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('marks discovered foods as web-grounded without breaking the source field', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(bravePayload))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  foods: [
                    {
                      name: 'Coca-Cola Zero',
                      brand: 'Coca-Cola',
                      servingLabel: '355 ml can',
                      servingGrams: 355,
                      kcal: 0,
                      protein: 0,
                      carbs: 0,
                      fat: 0,
                      category: 'drinks',
                      note: 'Zero sugar.'
                    }
                  ],
                  note: 'From a current result.'
                })
              },
              finish_reason: 'stop'
            }
          ],
          usage: { total_tokens: 20 }
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://worker.test/v1/foods/discover', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '127.0.0.14',
        'X-CalAI-Device': 'device-web-discover'
      }
    });
    const result = await discoverFoods(
      { DEEPSEEK_API_KEY: 'test', BRAVE_SEARCH_API_KEY: 'brave-test' } as Env,
      request,
      { query: 'coke zero' }
    );

    expect(result.foods[0]).toMatchObject({
      name: 'Coca-Cola Zero',
      source: 'ai',
      web: true
    });
    expect(result.webSources[0]?.domain).toBe('example.com');
  });
});
