import { describe, expect, it } from 'vitest';
import { normalizeSharedFoods, saveSharedFoods, searchSharedFoods } from './sharedFoods';
import type { Env } from './types';

describe('shared food library', () => {
  it('normalizes, clamps, and deduplicates AI foods', () => {
    const foods = normalizeSharedFoods(
      [
        {
          name: '  Paneer ',
          brand: '  ',
          servingLabel: '100 g',
          servingGrams: 99999,
          kcal: 99999,
          protein: -4,
          carbs: 3.5,
          fat: 20,
          category: 'dairy'
        },
        { name: 'paneer', kcal: 300 },
        { name: '', kcal: 100 },
        { name: 'Unknown category', kcal: 90, category: 'space food' }
      ],
      6
    );

    expect(foods).toHaveLength(2);
    expect(foods[0]).toMatchObject({
      name: 'Paneer',
      servingGrams: 5000,
      nutrients: { kcal: 5000, protein: 0, carbs: 3.5, fat: 20 },
      category: 'dairy'
    });
    expect(foods[1]?.category).toBeUndefined();
  });

  it('returns deterministic food ids without a database', async () => {
    const env = {} as Env;
    const first = await saveSharedFoods(env, 'paneer', [
      {
        name: 'Paneer',
        servingLabel: '100 g',
        servingGrams: 100,
        nutrients: { kcal: 296, protein: 18.3, carbs: 3.4, fat: 22.8 },
        category: 'dairy'
      }
    ]);
    const second = await saveSharedFoods(env, 'paneer', [
      {
        name: 'Paneer',
        servingLabel: '100 g',
        servingGrams: 100,
        nutrients: { kcal: 296, protein: 18.3, carbs: 3.4, fat: 22.8 },
        category: 'dairy'
      }
    ]);

    expect(first[0]?.source).toBe('ai');
    expect(first[0]?.id).toBe(second[0]?.id);
    expect(first[0]?.id).toMatch(/^ai-[a-f0-9]{24}$/);
    await expect(searchSharedFoods(env, 'paneer')).resolves.toEqual([]);
  });
});
