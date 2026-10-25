import type { Food, Meal } from '../types';

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function foodHaystack(food: Food): string {
  return normalizeText(`${food.name} ${food.brand ?? ''}`);
}

export function rankFoods(
  foods: Food[],
  query: string,
  favorites: string[],
  recents: string[],
  limit = 60
): Food[] {
  const normalizedQuery = normalizeText(query);
  const favoriteSet = new Set(favorites);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const matches = foods.filter((food) => {
    if (tokens.length === 0) return true;
    const haystack = foodHaystack(food);
    return tokens.every((token) => haystack.includes(token));
  });

  const recentIndex = (food: Food) => {
    const index = recents.indexOf(food.id);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  return matches
    .sort((a, b) => {
      const favoriteA = favoriteSet.has(a.id) ? 0 : 1;
      const favoriteB = favoriteSet.has(b.id) ? 0 : 1;
      if (favoriteA !== favoriteB) return favoriteA - favoriteB;

      if (normalizedQuery) {
        const startsA = normalizeText(a.name).startsWith(normalizedQuery) ? 0 : 1;
        const startsB = normalizeText(b.name).startsWith(normalizedQuery) ? 0 : 1;
        if (startsA !== startsB) return startsA - startsB;
      }

      const recentA = recentIndex(a);
      const recentB = recentIndex(b);
      if (recentA !== recentB) return recentA - recentB;

      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function mealOrder(meal: Meal): number {
  return ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(meal);
}
