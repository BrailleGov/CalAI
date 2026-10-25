import { describe, expect, it } from 'vitest';
import type { Entry, Profile } from '../types';
import {
  calculateTargets,
  entryNutrients,
  scaleNutrients,
  sumEntries
} from './nutrition';

const baseProfile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'maintain',
  rateKgPerWeek: 0
};

function entry(quantity: number, kcal: number, protein: number): Entry {
  return {
    id: `e-${quantity}-${kcal}`,
    date: '2026-10-24',
    meal: 'lunch',
    name: 'Test food',
    servingLabel: '1 serving',
    quantity,
    nutrients: { kcal, protein, carbs: 0, fat: 0 },
    createdAt: 0
  };
}

describe('calculateTargets', () => {
  it('returns maintenance targets for a maintain profile', () => {
    const targets = calculateTargets(baseProfile);
    expect(targets).toEqual({
      kcal: 2760,
      protein: 128,
      carbs: 389,
      fat: 77
    });
  });

  it('creates a deficit for weight loss and a surplus for gain', () => {
    const lose = calculateTargets({ ...baseProfile, goal: 'lose', rateKgPerWeek: 0.5 });
    const gain = calculateTargets({ ...baseProfile, goal: 'gain', rateKgPerWeek: 0.5 });
    const maintain = calculateTargets(baseProfile);

    expect(lose.kcal).toBeLessThan(maintain.kcal);
    expect(gain.kcal).toBeGreaterThan(maintain.kcal);
  });

  it('never goes below the safety floor', () => {
    const targets = calculateTargets({
      sex: 'female',
      age: 60,
      heightCm: 150,
      weightKg: 60,
      activity: 'sedentary',
      goal: 'lose',
      rateKgPerWeek: 0.75
    });

    expect(targets.kcal).toBeGreaterThanOrEqual(1200);
    expect(targets.protein).toBe(96);
  });
});

describe('nutrient math', () => {
  it('scales nutrients by quantity', () => {
    expect(scaleNutrients({ kcal: 100, protein: 10, carbs: 5, fat: 2 }, 1.5)).toEqual({
      kcal: 150,
      protein: 15,
      carbs: 7.5,
      fat: 3
    });
  });

  it('computes entry nutrients from the serving snapshot', () => {
    expect(entryNutrients(entry(2, 250, 20))).toEqual({
      kcal: 500,
      protein: 40,
      carbs: 0,
      fat: 0
    });
  });

  it('sums totals across entries', () => {
    const total = sumEntries([entry(1, 100, 5), entry(2, 50, 2)]);
    expect(total.kcal).toBe(200);
    expect(total.protein).toBe(9);
  });

  it('returns zero for an empty list', () => {
    expect(sumEntries([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
