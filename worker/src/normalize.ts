import type { FoodDTO } from './types';

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
};

type UsdaNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  foodNutrients?: UsdaNutrient[];
};

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

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeOffProduct(product: OffProduct): FoodDTO | null {
  const name = product.product_name?.trim();
  if (!name) return null;

  const nutriments = product.nutriments ?? {};
  const per100g = (key: string) => toNumber(nutriments[`${key}_100g`]);
  const energyKcal = per100g('energy-kcal');
  const energyKj = per100g('energy');
  const kcal = energyKcal ?? (energyKj !== null ? energyKj / 4.184 : null);
  if (kcal === null || kcal < 0 || kcal > 1000) return null;

  return {
    id: `off-${product.code?.trim() || slug(name)}`,
    name,
    brand: product.brands?.split(',')[0]?.trim() || undefined,
    barcode: product.code?.trim() || undefined,
    servingLabel: '100 g',
    servingGrams: 100,
    nutrients: {
      kcal: round1(kcal),
      protein: round1(Math.max(0, per100g('proteins') ?? 0)),
      carbs: round1(Math.max(0, per100g('carbohydrates') ?? 0)),
      fat: round1(Math.max(0, per100g('fat') ?? 0))
    },
    source: 'off',
    createdAt: 0
  };
}

function nutrientValue(
  nutrients: UsdaNutrient[],
  ids: number[],
  names: string[],
  unit?: string
): number | null {
  for (const item of nutrients) {
    if (item.nutrientId !== undefined && ids.includes(item.nutrientId)) {
      const value = toNumber(item.value);
      if (value !== null) return value;
    }
  }
  for (const item of nutrients) {
    if (
      item.nutrientName &&
      names.includes(item.nutrientName) &&
      (!unit || item.unitName === unit)
    ) {
      const value = toNumber(item.value);
      if (value !== null) return value;
    }
  }
  return null;
}

export function normalizeUsdaFood(food: UsdaFood): FoodDTO | null {
  const name = food.description?.trim();
  if (!name) return null;

  const nutrients = food.foodNutrients ?? [];
  const kcal =
    nutrientValue(nutrients, [1008, 2047], ['Energy'], 'kcal') ??
    (() => {
      const kj = nutrientValue(nutrients, [1062], ['Energy'], 'kJ');
      return kj !== null ? kj / 4.184 : null;
    })();

  if (kcal === null || kcal < 0 || kcal > 1000) return null;

  const protein = nutrientValue(nutrients, [1003], ['Protein']) ?? 0;
  const carbs =
    nutrientValue(
      nutrients,
      [1005],
      ['Carbohydrate, by difference', 'Carbohydrate, by summation']
    ) ?? 0;
  const fat = nutrientValue(nutrients, [1004], ['Total lipid (fat)']) ?? 0;

  return {
    id: `usda-${food.fdcId ?? slug(name)}`,
    name,
    brand: food.brandName?.trim() || food.brandOwner?.trim() || undefined,
    barcode: food.gtinUpc?.trim() || undefined,
    servingLabel: '100 g',
    servingGrams: 100,
    nutrients: {
      kcal: round1(kcal),
      protein: round1(Math.max(0, protein)),
      carbs: round1(Math.max(0, carbs)),
      fat: round1(Math.max(0, fat))
    },
    source: 'usda',
    createdAt: 0
  };
}

export function dedupeFoods(foods: FoodDTO[]): FoodDTO[] {
  const seen = new Set<string>();
  const output: FoodDTO[] = [];

  for (const food of foods) {
    const key = food.barcode
      ? `barcode:${food.barcode}`
      : `name:${slug(`${food.name} ${food.brand ?? ''}`)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(food);
  }

  return output;
}

export function scoreFood(food: FoodDTO, query: string): number {
  const q = query.toLowerCase().trim();
  const name = food.name.toLowerCase();
  const brand = (food.brand ?? '').toLowerCase();
  let score = 0;

  if (name === q) score += 100;
  else if (name.startsWith(q)) score += 60;
  else if (name.includes(q)) score += 30;
  if (brand.startsWith(q)) score += 15;
  if (food.source === 'usda') score += 3;
  if (food.servingGrams === 100) score += 1;

  return score;
}

export function filterRelevant(foods: FoodDTO[], query: string): FoodDTO[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return foods;

  return foods.filter((food) => {
    const haystack = `${food.name} ${food.brand ?? ''}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function rankFoods(foods: FoodDTO[], query: string, limit: number): FoodDTO[] {
  return [...foods]
    .sort((a, b) => {
      const diff = scoreFood(b, query) - scoreFood(a, query);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

