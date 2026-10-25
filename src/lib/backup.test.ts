import { describe, expect, it } from 'vitest';
import type { PersistedData } from '../types';
import { buildBackup, parseBackup, validatePersistedData } from './backup';

const data: PersistedData = {
  schemaVersion: 1,
  onboarded: true,
  profile: {
    sex: 'female',
    age: 28,
    heightCm: 165,
    weightKg: 62,
    activity: 'light',
    goal: 'maintain',
    rateKgPerWeek: 0
  },
  targets: { kcal: 1900, protein: 100, carbs: 200, fat: 63 },
  customFoods: [
    {
      id: 'food-1',
      name: 'Test bowl',
      servingLabel: '1 bowl',
      nutrients: { kcal: 420, protein: 25, carbs: 40, fat: 16 },
      source: 'custom',
      createdAt: 1
    }
  ],
  entries: [
    {
      id: 'entry-1',
      date: '2026-10-24',
      meal: 'lunch',
      foodId: 'food-1',
      name: 'Test bowl',
      servingLabel: '1 bowl',
      quantity: 1.5,
      nutrients: { kcal: 420, protein: 25, carbs: 40, fat: 16 },
      createdAt: 2
    }
  ],
  favorites: ['food-1'],
  recentFoodIds: ['food-1'],
  settings: { theme: 'system', units: 'metric' }
};

describe('backup', () => {
  it('round-trips a valid export', () => {
    const backup = buildBackup(data);
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.targets.kcal).toBe(1900);
    }
  });

  it('rejects a foreign file', () => {
    const result = parseBackup(JSON.stringify({ app: 'other', data }));
    expect(result.ok).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const result = parseBackup('not json');
    expect(result.ok).toBe(false);
  });

  it('rejects invalid entry quantities', () => {
    const broken = {
      ...data,
      entries: [{ ...data.entries[0], quantity: 0 }]
    };
    const result = validatePersistedData(broken);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid date', () => {
    const broken = {
      ...data,
      entries: [{ ...data.entries[0], date: '2026-02-31' }]
    };
    const result = validatePersistedData(broken);
    expect(result.ok).toBe(false);
  });

  it('rejects a future schema version', () => {
    const result = validatePersistedData({ ...data, schemaVersion: 2 });
    expect(result.ok).toBe(false);
  });
});
