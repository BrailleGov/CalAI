import { describe, expect, it, vi } from 'vitest';
import {
  AiError,
  analyzeMealImage,
  chatWithCoach,
  normalizeAiItems
} from './ai';
import type { Env } from './types';

describe('worker AI normalization', () => {
  it('clamps and limits items', () => {
    const items = normalizeAiItems(
      [
        {
          name: '  Toast ',
          grams: 99999,
          kcal: 99999,
          protein: -1,
          carbs: 20,
          fat: 4,
          confidence: 9
        },
        ...Array.from({ length: 20 }, (_, index) => ({ name: `Item ${index}`, kcal: 10 }))
      ],
      4
    );
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      name: 'Toast',
      grams: 5000,
      kcal: 5000,
      protein: 0,
      confidence: 1
    });
  });

  it('rejects an image whose content does not match its type', async () => {
    const env = { DEEPSEEK_API_KEY: 'test' } as Env;
    const request = new Request('https://worker.test/v1/ai/recognize', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '127.0.0.1' }
    });
    await expect(
      analyzeMealImage(env, request, {
        image: 'data:image/png;base64,aGVsbG8='
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates provider output before returning it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: 'You averaged 500 kcal over the last 7 days.',
                  window: 'last 7 days',
                  suggestions: ['What about protein?'],
                  proposal: {
                    meal: 'lunch',
                    items: [
                      {
                        name: 'Egg',
                        grams: 50,
                        kcal: 72,
                        protein: 6,
                        carbs: 0,
                        fat: 5,
                        confidence: 0.8
                      }
                    ]
                  }
                })
              },
              finish_reason: 'stop'
            }
          ],
          usage: { total_tokens: 20 }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const env = { DEEPSEEK_API_KEY: 'test' } as Env;
    const request = new Request('https://worker.test/v1/ai/chat', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '127.0.0.2' }
    });

    try {
      const result = (await chatWithCoach(env, request, {
        messages: [{ role: 'user', content: 'How did I do?' }],
        context: { targets: { kcal: 2000 } }
      })) as {
        reply: string;
        window: string;
        proposal: { items: { name: string; confidence: number }[] };
      };
      expect(result.reply).toContain('500 kcal');
      expect(result.window).toBe('last 7 days');
      expect(result.proposal.items[0]).toMatchObject({ name: 'Egg', confidence: 0.8 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports missing configuration clearly', async () => {
    const request = new Request('https://worker.test/v1/ai/chat', { method: 'POST' });
    await expect(
      chatWithCoach({} as Env, request, {
        messages: [{ role: 'user', content: 'hi' }],
        context: {}
      })
    ).rejects.toBeInstanceOf(AiError);
  });
});
