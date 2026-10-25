import { describe, expect, it } from 'vitest';
import { FOOD_CATEGORIES } from '../types';
import { SEED_FOODS, SEED_FOODS_BY_CATEGORY } from './seedFoods';

describe('seed food library', () => {
  it('has unique ids and case-insensitive names', () => {
    const ids = new Set(SEED_FOODS.map((food) => food.id));
    const names = new Set(SEED_FOODS.map((food) => food.name.toLowerCase()));
    expect(ids.size).toBe(SEED_FOODS.length);
    expect(names.size).toBe(SEED_FOODS.length);
  });

  it('is large enough to be useful offline', () => {
    expect(SEED_FOODS.length).toBeGreaterThan(200);
  });

  it('assigns every food to a known category', () => {
    for (const food of SEED_FOODS) {
      expect(food.category).toBeDefined();
      expect(FOOD_CATEGORIES).toContain(food.category);
      expect(food.nutrients.kcal).toBeGreaterThanOrEqual(0);
      expect(food.nutrients.protein).toBeGreaterThanOrEqual(0);
      expect(food.nutrients.carbs).toBeGreaterThanOrEqual(0);
      expect(food.nutrients.fat).toBeGreaterThanOrEqual(0);
    }

    const counted = FOOD_CATEGORIES.reduce(
      (total, category) => total + SEED_FOODS_BY_CATEGORY[category].length,
      0
    );
    expect(counted).toBe(SEED_FOODS.length);
  });
});
