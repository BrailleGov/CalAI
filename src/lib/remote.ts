import type { Food } from '../types';
import { normalizeText } from './search';

const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_FIELDS =
  'code,product_name,brands,nutriments,serving_size,serving_quantity,quantity';
const DEVICE_KEY = 'calai:device';

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '')
  .trim()
  .replace(/\/+$/, '');

export type RemoteSource = 'off' | 'usda' | 'ai';

export type RemoteSearchResponse = {
  foods: Food[];
  sources: RemoteSource[];
  cached: boolean;
};

export class RemoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteError';
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, unknown>;
};

export function barcodeFoodFromOff(product: OffProduct): Food | null {
  const name = product.product_name?.trim();
  const code = product.code?.trim();
  if (!name) return null;

  const nutriments = product.nutriments ?? {};
  const per100g = (key: string) => toNumber(nutriments[`${key}_100g`]);
  const kcal =
    per100g('energy-kcal') ??
    (per100g('energy') !== null ? (per100g('energy') as number) / 4.184 : null);
  const protein = per100g('proteins');
  const carbs = per100g('carbohydrates');
  const fat = per100g('fat');

  if (kcal === null || kcal < 0 || kcal > 1000) return null;

  return {
    id: `off-${code || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    brand: product.brands?.split(',')[0]?.trim() || undefined,
    barcode: code || undefined,
    servingLabel: '100 g',
    servingGrams: 100,
    nutrients: {
      kcal: round1(kcal),
      protein: round1(Math.max(0, protein ?? 0)),
      carbs: round1(Math.max(0, carbs ?? 0)),
      fat: round1(Math.max(0, fat ?? 0))
    },
    source: 'off',
    createdAt: Date.now()
  };
}

function sanitizeFoods(value: unknown): Food[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Food => {
    if (!item || typeof item !== 'object') return false;
    const food = item as Partial<Food>;
    return (
      typeof food.id === 'string' &&
      typeof food.name === 'string' &&
      food.name.length > 0 &&
      food.name.length <= 200 &&
      typeof food.servingLabel === 'string' &&
      (food.source === 'off' || food.source === 'usda' || food.source === 'ai') &&
      Boolean(food.nutrients) &&
      typeof food.nutrients?.kcal === 'number' &&
      Number.isFinite(food.nutrients.kcal)
    );
  });
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort);

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {})
        }
      });

      if (response.ok) return (await response.json()) as unknown;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt === 0 && !controller.signal.aborted) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        continue;
      }

      throw new RemoteError(
        response.status === 429
          ? 'Food search is busy. Try again in a moment.'
          : 'Food search is unavailable right now.'
      );
    }

    throw new RemoteError('Food search is unavailable right now.');
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    throw new RemoteError(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Food search timed out.'
        : 'Food search needs a connection.'
    );
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseOffProducts(payload: unknown): Food[] {
  if (!payload || typeof payload !== 'object') return [];
  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  const foods: Food[] = [];
  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const food = barcodeFoodFromOff(product as OffProduct);
    if (food) foods.push(food);
  }
  return foods;
}

async function searchOffDirect(query: string, signal: AbortSignal): Promise<Food[]> {
  const slug = slugify(query);
  if (!slug) return [];

  const params = (key: 'brands_tags' | 'categories_tags', value: string) => {
    const search = new URLSearchParams({
      [key]: value,
      page_size: '20',
      fields: OFF_FIELDS
    });
    return `${OFF_BASE}/api/v2/search?${search.toString()}`;
  };

  const urls = [params('brands_tags', slug), params('categories_tags', `en:${slug}`)];
  if (!slug.endsWith('s')) {
    urls.push(params('categories_tags', `en:${slug}s`));
  }

  const settled = await Promise.allSettled(
    urls.map((url) => fetchJson(url, { signal }))
  );

  const foods: Food[] = [];
  let succeeded = false;
  let lastError: unknown = null;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      succeeded = true;
      foods.push(...parseOffProducts(result.value));
    } else {
      lastError = result.reason;
    }
  }

  if (!succeeded) {
    throw lastError instanceof Error
      ? lastError
      : new RemoteError('Food search is unavailable right now.');
  }

  const seen = new Set<string>();
  const normalizedQuery = normalizeText(query);
  const score = (food: Food) => {
    const name = normalizeText(food.name);
    const brand = normalizeText(food.brand ?? '');
    if (name === normalizedQuery) return 3;
    if (name.startsWith(normalizedQuery)) return 2;
    if (name.includes(normalizedQuery)) return 1;
    if (brand.includes(normalizedQuery)) return 1;
    return 0;
  };

  return foods
    .filter((food) => {
      const key = food.barcode || food.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 24);
}

export async function searchRemoteFoods(
  query: string,
  signal: AbortSignal
): Promise<RemoteSearchResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { foods: [], sources: [], cached: false };
  }

  if (API_BASE) {
    const params = new URLSearchParams({ q: trimmed, limit: '24' });
    const payload = await fetchJson(
      `${API_BASE}/v1/foods/search?${params.toString()}`,
      { signal }
    );

    if (!payload || typeof payload !== 'object') {
      return { foods: [], sources: [], cached: false };
    }

    const record = payload as {
      foods?: unknown;
      sources?: unknown;
      cached?: unknown;
    };
    const sources = Array.isArray(record.sources)
      ? record.sources.filter(
          (source): source is RemoteSource =>
          source === 'off' || source === 'usda' || source === 'ai'
        )
      : [];

    return {
      foods: sanitizeFoods(record.foods),
      sources,
      cached: record.cached === true
    };
  }

  return {
    foods: await searchOffDirect(trimmed, signal),
    sources: ['off'],
    cached: false
  };
}

async function barcodeOffDirect(code: string, signal: AbortSignal): Promise<Food | null> {
  const payload = await fetchJson(
    `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`,
    { signal }
  );

  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { status?: number; product?: OffProduct };
  if (record.status !== 1 || !record.product) return null;
  return barcodeFoodFromOff(record.product);
}

export async function lookupBarcode(
  code: string,
  signal: AbortSignal
): Promise<Food | null> {
  if (!/^\d{8,14}$/.test(code)) {
    throw new RemoteError('Enter an 8 to 14 digit barcode.');
  }

  if (API_BASE) {
    const payload = await fetchJson(
      `${API_BASE}/v1/foods/barcode/${encodeURIComponent(code)}`,
      { signal }
    );

    if (!payload || typeof payload !== 'object') return null;
    const record = payload as { foods?: unknown };
    return sanitizeFoods(record.foods)[0] ?? null;
  }

  return barcodeOffDirect(code, signal);
}

function newDeviceToken(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceToken(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const token = newDeviceToken();
    localStorage.setItem(DEVICE_KEY, token);
    return token;
  } catch {
    return '';
  }
}

/** Used when a device ID exists server-side but its local bearer token was lost. */
export function rotateDeviceToken(): string {
  const token = newDeviceToken();
  try {
    localStorage.setItem(DEVICE_KEY, token);
    localStorage.removeItem('calai:sync-token');
  } catch {
    // Storage is blocked; the caller will report that cloud backup cannot be linked.
  }
  return token;
}

export function isRemoteSource(source: Food['source']): boolean {
  return source === 'off' || source === 'usda' || source === 'ai';
}

export type SharedFoodResponse = {
  foods: Food[];
  sources: RemoteSource[];
  note?: string;
};

export async function searchSharedFoods(
  query: string,
  signal: AbortSignal
): Promise<SharedFoodResponse> {
  const trimmed = query.trim();
  if (!API_BASE || trimmed.length < 2) {
    return { foods: [], sources: [] };
  }

  const params = new URLSearchParams({ q: trimmed, limit: '12' });
  const payload = await fetchJson(
    `${API_BASE}/v1/foods/library?${params.toString()}`,
    { signal }
  );

  if (!payload || typeof payload !== 'object') {
    return { foods: [], sources: [] };
  }

  const record = payload as { foods?: unknown; sources?: unknown; note?: unknown };
  return {
    foods: sanitizeFoods(record.foods),
    sources: Array.isArray(record.sources)
      ? record.sources.filter(
          (source): source is RemoteSource =>
            source === 'off' || source === 'usda' || source === 'ai'
        )
      : ['ai'],
    ...(typeof record.note === 'string' ? { note: record.note } : {})
  };
}

export async function discoverSharedFoods(
  query: string,
  signal: AbortSignal
): Promise<SharedFoodResponse> {
  const trimmed = query.trim();
  if (!API_BASE || trimmed.length < 2) {
    return { foods: [], sources: [] };
  }

  const payload = await fetchJson(
    `${API_BASE}/v1/foods/discover`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-CalAI-Device': getDeviceToken()
      },
      body: JSON.stringify({ query: trimmed })
    },
    45_000
  );

  if (!payload || typeof payload !== 'object') {
    return { foods: [], sources: [] };
  }

  const record = payload as { foods?: unknown; sources?: unknown; note?: unknown };
  return {
    foods: sanitizeFoods(record.foods),
    sources: ['ai'],
    ...(typeof record.note === 'string' ? { note: record.note } : {})
  };
}
