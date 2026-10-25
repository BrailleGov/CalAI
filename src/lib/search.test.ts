import { describe, expect, it } from 'vitest';
import type { Food } from '../types';
import { normalizeText, rankFoods } from './search';

function food(id: string, name: string, brand?: string): Food {
  return {
    id,
    name,
    brand,
    servingLabel: '1 serving',
    nutrients: { kcal: 100, protein: 10, carbs: 10, fat: 2 },
    source: 'seed',
    createdAt: 0
  };
}

const foods = [
  food('a', 'Apple'),
  food('b', 'Banana'),
  food('c', 'Café latte', 'Corner'),
  food('d', 'Chicken breast'),
  food('e', 'Greek yogurt')
];

describe('food search', () => {
  it('normalises case and diacritics', () => {
    expect(normalizeText('  Café  Latté ')).toBe('cafe latte');
    expect(rankFoods(foods, 'cafe', [], []).map((item) => item.id)).toEqual(['c']);
  });

  it('matches every token across name and brand', () => {
    expect(rankFoods(foods, 'corner cafe', [], []).map((item) => item.id)).toEqual(['c']);
  });

  it('puts favorites before other matches', () => {
    const result = rankFoods(foods, '', ['e'], []);
    expect(result[0]?.id).toBe('e');
  });

  it('orders recents after favorites', () => {
    const result = rankFoods(foods, '', ['e'], ['b', 'a']);
    expect(result.slice(0, 3).map((item) => item.id)).toEqual(['e', 'b', 'a']);
  });

  it('returns nothing for an unmatched query', () => {
    expect(rankFoods(foods, 'zzz', [], [])).toEqual([]);
  });
});
