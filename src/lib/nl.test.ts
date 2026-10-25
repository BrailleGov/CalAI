import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/seedFoods';
import { parseFoodTextLocally, splitMealText } from './nl';

describe('local meal text parser', () => {
  it('splits common separators', () => {
    expect(splitMealText('2 eggs and toast, coffee\nbanana')).toEqual([
      '2 eggs',
      'toast',
      'coffee',
      'banana'
    ]);
  });

  it('matches foods that exist in the library', () => {
    const result = parseFoodTextLocally('2 eggs and banana', SEED_FOODS);
    expect(result.items.map((item) => item.food.id)).toEqual([
      'seed-egg',
      'seed-banana'
    ]);
    expect(result.items.map((item) => item.quantity)).toEqual([2, 1]);
    expect(result.unmatched).toEqual([]);
  });

  it('converts grams when the food has a gram serving', () => {
    const result = parseFoodTextLocally('150 g chicken breast', SEED_FOODS);
    expect(result.items[0]?.food.id).toBe('seed-chicken-breast');
    expect(result.items[0]?.quantity).toBe(1.5);
  });

  it('understands fractions and word numbers', () => {
    const result = parseFoodTextLocally('1/2 avocado and two eggs', SEED_FOODS);
    expect(result.items.map((item) => item.quantity)).toEqual([0.5, 2]);
  });

  it('does not invent an unmatched food', () => {
    const result = parseFoodTextLocally('mystery stew with zorp', SEED_FOODS);
    expect(result.items).toHaveLength(0);
    expect(result.unmatched[0]).toBe('mystery stew with zorp');
  });
});
