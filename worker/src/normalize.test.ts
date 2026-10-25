import { describe, expect, it } from 'vitest';
import {
  dedupeFoods,
  normalizeOffProduct,
  normalizeOffSearchHit,
  normalizeUsdaFood,
  rankFoods
} from './normalize';

describe('worker food normalisation', () => {
  it('normalises an Open Food Facts product to 100 g', () => {
    const food = normalizeOffProduct({
      code: '12345678',
      product_name: 'Banana',
      brands: 'Example Brand, Other',
      nutriments: {
        'energy-kcal_100g': 89,
        proteins_100g: 1.1,
        carbohydrates_100g: 22.8,
        fat_100g: 0.3
      }
    });

    expect(food).toMatchObject({
      id: 'off-12345678',
      name: 'Banana',
      brand: 'Example Brand',
      barcode: '12345678',
      servingLabel: '100 g',
      source: 'off',
      nutrients: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }
    });
  });

  it('converts kilojoules when kcal is missing', () => {
    const food = normalizeOffProduct({
      code: '1',
      product_name: 'Juice',
      nutriments: { energy_100g: 418.4 }
    });
    expect(food?.nutrients.kcal).toBe(100);
  });

  it('rejects products with no name or implausible energy', () => {
    expect(normalizeOffProduct({ code: '1' })).toBeNull();
    expect(
      normalizeOffProduct({
        product_name: 'Impossible',
        nutriments: { 'energy-kcal_100g': 5000 }
      })
    ).toBeNull();
  });

  it('normalises USDA foods using nutrient ids', () => {
    const food = normalizeUsdaFood({
      fdcId: 42,
      description: 'Chicken breast',
      brandOwner: 'USDA',
      foodNutrients: [
        { nutrientId: 1008, nutrientName: 'Energy', unitName: 'kcal', value: 165 },
        { nutrientId: 1003, nutrientName: 'Protein', unitName: 'g', value: 31 },
        { nutrientId: 1005, nutrientName: 'Carbohydrate, by difference', value: 0 },
        { nutrientId: 1004, nutrientName: 'Total lipid (fat)', value: 3.6 }
      ]
    });

    expect(food).toMatchObject({
      id: 'usda-42',
      source: 'usda',
      nutrients: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
    });
  });

  it('normalises a search-a-licious hit', () => {
    const food = normalizeOffSearchHit({
      code: '44444444',
      product_name: 'Nutella',
      brands: ['Nutella', 'Ferrero'],
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3 }
    });

    expect(food).toMatchObject({
      id: 'off-44444444',
      name: 'Nutella',
      brand: 'Nutella',
      nutrients: { kcal: 539, protein: 6.3 }
    });
  });

  it('dedupes by barcode and ranks exact names first', () => {
    const a = normalizeOffProduct({
      code: '11111111',
      product_name: 'Milk',
      nutriments: { 'energy-kcal_100g': 42 }
    });
    const b = normalizeOffProduct({
      code: '11111111',
      product_name: 'Milk duplicate',
      nutriments: { 'energy-kcal_100g': 42 }
    });
    const c = normalizeUsdaFood({
      fdcId: 1,
      description: 'Milk, whole',
      foodNutrients: [{ nutrientId: 1008, value: 61 }]
    });

    const foods = [a, b, c].filter((food) => food !== null);
    expect(dedupeFoods(foods)).toHaveLength(2);
    expect(rankFoods(dedupeFoods(foods), 'milk', 5)[0]?.name).toBe('Milk');
  });
});
