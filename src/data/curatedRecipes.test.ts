import { describe, expect, it } from 'vitest';
import { CURATED_RECIPES } from './curatedRecipes';
import { SEED_FOODS } from './seedFoods';
import { recipePerServing } from '../lib/recipes';

describe('curated recipe book', () => {
  it('has unique ids and complete instructions', () => {
    const ids = new Set(CURATED_RECIPES.map((recipe) => recipe.id));
    expect(ids.size).toBe(CURATED_RECIPES.length);
    for (const recipe of CURATED_RECIPES) {
      expect(recipe.source).toBe('curated');
      expect(recipe.instructions?.length).toBeGreaterThanOrEqual(3);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipePerServing(recipe).kcal).toBeGreaterThan(0);
    }
  });

  it('uses only foods that exist in the seed library', () => {
    const seedIds = new Set(SEED_FOODS.map((food) => food.id));
    for (const recipe of CURATED_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(ingredient.foodId).toBeDefined();
        expect(seedIds.has(ingredient.foodId as string)).toBe(true);
      }
    }
  });

  it('has personalized tags on every recipe', () => {
    for (const recipe of CURATED_RECIPES) {
      expect(recipe.tags?.length).toBeGreaterThan(0);
    }
  });
});
