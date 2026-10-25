import { ensureSchema } from './db';
import { sha256Hex } from './crypto';
import type { Env, FoodDTO, Nutrients } from './types';

const CATEGORIES = new Set([
  'protein',
  'dairy',
  'grains',
  'fruit',
  'vegetables',
  'fats',
  'drinks',
  'meals',
  'snacks',
  'condiments'
]);

export type SharedFoodInput = {
  name: string;
  brand?: string;
  servingLabel: string;
  servingGrams?: number;
  nutrients: Nutrients;
  category?: string;
};

type SharedFoodRow = {
  id: string;
  name: string;
  brand: string | null;
  serving_label: string;
  serving_grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string | null;
  created_at: number;
};

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function num(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeSharedFoods(value: unknown, limit = 6): SharedFoodInput[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: SharedFoodInput[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const name = str(record.name, 120);
    if (!name) continue;
    const key = normalized(name);
    if (!key || seen.has(key)) continue;

    const kcal = num(record.kcal, 0, 5000);
    if (kcal === null) continue;

    const servingGrams = num(record.servingGrams, 0, 5000);
    const category = str(record.category, 40);
    seen.add(key);
    output.push({
      name,
      ...(str(record.brand, 80) ? { brand: str(record.brand, 80) } : {}),
      servingLabel: str(record.servingLabel, 80) || (servingGrams ? `${round1(servingGrams)} g` : '1 serving'),
      ...(servingGrams && servingGrams > 0 ? { servingGrams: round1(servingGrams) } : {}),
      nutrients: {
        kcal: Math.round(kcal),
        protein: round1(num(record.protein, 0, 1000) ?? 0),
        carbs: round1(num(record.carbs, 0, 1000) ?? 0),
        fat: round1(num(record.fat, 0, 1000) ?? 0)
      },
      ...(CATEGORIES.has(category) ? { category } : {})
    });

    if (output.length >= limit) break;
  }

  return output;
}

function toDto(row: SharedFoodRow): FoodDTO {
  return {
    id: row.id,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    servingLabel: row.serving_label,
    ...(row.serving_grams ? { servingGrams: row.serving_grams } : {}),
    nutrients: {
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat
    },
    ...(row.category ? { category: row.category } : {}),
    source: 'ai',
    createdAt: row.created_at
  };
}

export async function saveSharedFoods(
  env: Env,
  query: string,
  foods: SharedFoodInput[]
): Promise<FoodDTO[]> {
  const now = Date.now();
  const normalizedQuery = normalized(query).slice(0, 120);
  const rows: SharedFoodRow[] = [];

  for (const food of foods) {
    const key = `${normalized(food.name)}|${normalized(food.brand ?? '')}|${normalized(
      food.servingLabel
    )}`;
    const id = `ai-${(await sha256Hex(key)).slice(0, 24)}`;
    rows.push({
      id,
      name: food.name,
      brand: food.brand ?? null,
      serving_label: food.servingLabel,
      serving_grams: food.servingGrams ?? null,
      kcal: food.nutrients.kcal,
      protein: food.nutrients.protein,
      carbs: food.nutrients.carbs,
      fat: food.nutrients.fat,
      category: food.category ?? null,
      created_at: now
    });
  }

  if (env.DB && rows.length > 0) {
    await ensureSchema(env);
    for (const row of rows) {
      await env.DB.prepare(
        `INSERT INTO shared_foods
          (id, name, brand, serving_label, serving_grams, kcal, protein, carbs, fat, category, source, query, hits, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, 0, ?)
         ON CONFLICT(id) DO UPDATE SET query = excluded.query, hits = shared_foods.hits + 1`
      )
        .bind(
          row.id,
          row.name,
          row.brand,
          row.serving_label,
          row.serving_grams,
          row.kcal,
          row.protein,
          row.carbs,
          row.fat,
          row.category,
          normalizedQuery,
          row.created_at
        )
        .run();
    }
  }

  return rows.map(toDto);
}

export async function searchSharedFoods(
  env: Env,
  query: string,
  limit = 12
): Promise<FoodDTO[]> {
  if (!env.DB) return [];
  const tokens = normalized(query)
    .split(' ')
    .filter(Boolean)
    .slice(0, 4);
  if (tokens.length === 0) return [];

  await ensureSchema(env);
  const clause = tokens
    .map(() => '(lower(name) LIKE ? OR lower(brand) LIKE ? OR query LIKE ?)')
    .join(' AND ');
  const bindings = tokens.flatMap((token) => [
    `%${token}%`,
    `%${token}%`,
    `%${token}%`
  ]);

  const result = await env.DB.prepare(
    `SELECT id, name, brand, serving_label, serving_grams, kcal, protein, carbs, fat, category, created_at
     FROM shared_foods
     WHERE ${clause}
     ORDER BY hits DESC, created_at DESC
     LIMIT ?`
  )
    .bind(...bindings, Math.min(30, Math.max(1, limit)))
    .all<SharedFoodRow>();

  return (result.results ?? []).map(toDto);
}
