import { normalizeUsdaFood } from '../normalize';
import type { FoodDTO } from '../types';

const BASE = 'https://api.nal.usda.gov/fdc/v1';
const USER_AGENT = 'CalAI/0.2 (https://github.com/BrailleGov/CalAI)';

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`USDA responded ${response.status}`);
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchUsda(
  query: string,
  limit: number,
  apiKey: string
): Promise<FoodDTO[]> {
  const payload = await fetchJson(
    `${BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        pageSize: Math.min(30, Math.max(1, limit)),
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']
      })
    }
  );

  if (!payload || typeof payload !== 'object') return [];
  const foods = (payload as { foods?: unknown }).foods;
  if (!Array.isArray(foods)) return [];

  const output: FoodDTO[] = [];
  for (const food of foods) {
    if (!food || typeof food !== 'object') continue;
    const normalized = normalizeUsdaFood(food);
    if (normalized) output.push(normalized);
  }
  return output;
}
