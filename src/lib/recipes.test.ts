import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types';
import { recipePerServing, recipeToFood, recipeTotals } from './recipes';

const recipe: Recipe = {
  id: 'r1',
  name: 'Rice bowl',
  servings: 2,
  ingredients: [
    {
      foodId: 'seed-white-rice',
      name: 'White rice, cooked',
      servingLabel: '1 cup',
      quantity: 2,
      nutrients: { kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4 }
    },
    {
      foodId: 'seed-chicken-breast',
      name: 'Chicken breast, cooked',
      servingLabel: '100 g',
      quantity: 1,
      nutrients: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
    }
  ],
  createdAt: 1,
  updatedAt: 2
};

describe('recipes', () => {
  it('sums ingredients using their quantity', () => {
    expect(recipeTotals(recipe)).toEqual({
      kcal: 575,
      protein: 39.6,
      carbs: 89,
      fat: 4.4
    });
  });

  it('divides totals by servings', () => {
    expect(recipePerServing(recipe)).toEqual({
      kcal: 287.5,
      protein: 19.8,
      carbs: 44.5,
      fat: 2.2
    });
  });

  it('converts a recipe into a loggable food', () => {
    const food = recipeToFood(recipe);
    expect(food.id).toBe('recipe-r1');
    expect(food.source).toBe('recipe');
    expect(food.servingLabel).toBe('1 of 2 servings');
    expect(food.nutrients.kcal).toBe(287.5);
  });
});
