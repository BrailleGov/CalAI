import { normalizeOffProduct } from '../normalize';
import type { FoodDTO } from '../types';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';
const USER_AGENT = 'CalAI/0.2 (https://github.com/BrailleGov/CalAI)';

type OffProduct = Parameters<typeof normalizeOffProduct>[0];

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

export async function searchOff(query: string, limit: number): Promise<FoodDTO[]> {
  const params = new URLSearchParams({
    search_terms: query,
    page_size: String(Math.min(30, Math.max(1, limit))),
    fields: FIELDS
  });

  const payload = await fetchJson(`${BASE}/api/v2/search?${params.toString()}`);
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

export async function lookupOffBarcode(code: string): Promise<FoodDTO | null> {
  const payload = await fetchJson(
    `${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  );

  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { status?: number; product?: OffProduct };
  if (record.status !== 1 || !record.product) return null;
  return normalizeOffProduct(record.product);
}
