import type { Food, Nutrients, Recipe } from '../types';
import { EMPTY_NUTRIENTS, addNutrients, scaleNutrients } from './nutrition';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function recipeTotals(recipe: Recipe): Nutrients {
  return recipe.ingredients.reduce<Nutrients>(
    (total, ingredient) =>
      addNutrients(total, scaleNutrients(ingredient.nutrients, ingredient.quantity)),
    EMPTY_NUTRIENTS
  );
}

export function recipePerServing(recipe: Recipe): Nutrients {
  const totals = recipeTotals(recipe);
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  return {
    kcal: round1(totals.kcal / servings),
    protein: round1(totals.protein / servings),
    carbs: round1(totals.carbs / servings),
    fat: round1(totals.fat / servings)
  };
}

export function recipeToFood(recipe: Recipe): Food {
  return {
    id: `recipe-${recipe.id}`,
    name: recipe.name,
    servingLabel:
      recipe.servings === 1 ? '1 recipe' : `1 of ${recipe.servings} servings`,
    nutrients: recipePerServing(recipe),
    source: 'recipe',
    createdAt: recipe.updatedAt
  };
}
