import { normalizeOffProduct, normalizeOffSearchHit } from '../normalize';
import type { OffProduct } from '../normalize';
import type { FoodDTO } from '../types';

const WORLD_BASE = 'https://world.openfoodfacts.org';
const SEARCH_BASE = 'https://search.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';
const USER_AGENT = 'CalAI/0.2 (https://github.com/BrailleGov/CalAI)';

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Open Food Facts responded ${response.status}`);
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
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

function productsFromPayload(payload: unknown): FoodDTO[] {
  if (!payload || typeof payload !== 'object') return [];
  const products = (payload as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];

  const foods: FoodDTO[] = [];
  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const food = normalizeOffProduct(product as OffProduct);
    if (food) foods.push(food);
  }
  return foods;
}

async function searchSearchALicious(query: string, limit: number): Promise<FoodDTO[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(30, Math.max(1, limit)))
  });
  const payload = await fetchJson(`${SEARCH_BASE}/search?${params.toString()}`);
  if (!payload || typeof payload !== 'object') return [];
  const hits = (payload as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];

  const foods: FoodDTO[] = [];
  for (const hit of hits) {
    if (!hit || typeof hit !== 'object') continue;
    const food = normalizeOffSearchHit(hit);
    if (food) foods.push(food);
  }
  return foods;
}

async function searchTagged(query: string, limit: number): Promise<FoodDTO[]> {
  const slug = slugify(query);
  if (!slug) return [];

  const tagUrl = (key: 'brands_tags' | 'categories_tags', value: string) => {
    const params = new URLSearchParams({
      [key]: value,
      page_size: String(Math.min(30, Math.max(1, limit))),
      fields: FIELDS
    });
    return `${WORLD_BASE}/api/v2/search?${params.toString()}`;
  };

  const urls = [tagUrl('brands_tags', slug), tagUrl('categories_tags', `en:${slug}`)];
  if (!slug.endsWith('s')) {
    urls.push(tagUrl('categories_tags', `en:${slug}s`));
  }

  const settled = await Promise.allSettled(urls.map((url) => fetchJson(url)));
  const foods: FoodDTO[] = [];
  let succeeded = false;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      succeeded = true;
      foods.push(...productsFromPayload(result.value));
    }
  }

  if (!succeeded) {
    throw new Error('Open Food Facts search is unavailable');
  }
  return foods;
}

export async function searchOff(query: string, limit: number): Promise<FoodDTO[]> {
  try {
    const foods = await searchSearchALicious(query, limit);
    if (foods.length > 0) return foods;
  } catch {
    // Fall through to the tag search; both use the public OFF API.
  }

  return searchTagged(query, limit);
}

export async function lookupOffBarcode(code: string): Promise<FoodDTO | null> {
  const payload = await fetchJson(
    `${WORLD_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  );

  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { status?: number; product?: OffProduct };
  if (record.status !== 1 || !record.product) return null;
  return normalizeOffProduct(record.product);
}
