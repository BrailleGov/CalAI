import { describe, expect, it } from 'vitest';
import type { PersistedData } from '../types';
import { parseLegacyState } from './legacy';

const data: PersistedData = {
  schemaVersion: 1,
  onboarded: true,
  profile: null,
  targets: { kcal: 2000, protein: 120, carbs: 220, fat: 67 },
  customFoods: [],
  entries: [],
  favorites: [],
  recentFoodIds: [],
  settings: { theme: 'dark', units: 'metric' }
};

describe('legacy IndexedDB state', () => {
  it('accepts a Zustand persist envelope', () => {
    const raw = JSON.stringify({ state: data, version: 1 });
    expect(parseLegacyState(raw)).toEqual(data);
  });

  it('accepts a bare state object', () => {
    expect(parseLegacyState(JSON.stringify(data))).toEqual(data);
  });

  it('rejects malformed or empty values', () => {
    expect(parseLegacyState(null)).toBeNull();
    expect(parseLegacyState('not json')).toBeNull();
    expect(parseLegacyState(JSON.stringify({ state: { schemaVersion: 99 } }))).toBeNull();
  });
});
