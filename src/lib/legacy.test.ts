import { describe, expect, it } from 'vitest';
import type { PersistedData } from '../types';
import { parseLegacyState } from './legacy';

const data: PersistedData = {
  schemaVersion: 3,
  onboarded: true,
  profile: null,
  targets: { kcal: 2000, protein: 120, carbs: 220, fat: 67 },
  customFoods: [],
  remoteFoods: [],
  entries: [],
  favorites: [],
  recentFoodIds: [],
  recipes: [],
  weights: [],
  water: [],
  reminders: {
    enabled: false,
    quietStart: '21:00',
    quietEnd: '07:00',
    items: [
      { id: 'breakfast', meal: 'breakfast', time: '08:00', enabled: false },
      { id: 'lunch', meal: 'lunch', time: '12:30', enabled: false },
      { id: 'dinner', meal: 'dinner', time: '18:30', enabled: false },
      { id: 'snack', meal: 'snack', time: '15:30', enabled: false }
    ]
  },
  settings: { theme: 'dark', units: 'metric', waterGoalMl: 2000 },
  preferences: {
    trackingStyle: 'detailed',
    photoLogging: true,
    textLogging: true,
    aiChat: true,
    recipeIdeas: true,
    aiConsentAt: null,
    diet: 'no_preference',
    avoidIngredients: [],
    cuisines: []
  },
  sms: { enabled: false, phone: '', consentAt: null },
  cloudSync: { enabled: false, lastSyncedAt: null },
  chatMessages: []
};

describe('legacy IndexedDB state', () => {
  it('accepts a Zustand persist envelope', () => {
    const raw = JSON.stringify({ state: data, version: 2 });
    expect(parseLegacyState(raw)).toEqual(data);
  });

  it('accepts a bare state object', () => {
    expect(parseLegacyState(JSON.stringify(data))).toEqual(data);
  });

  it('migrates a v0.1.0 IndexedDB diary', () => {
    const v1 = {
      schemaVersion: 1,
      onboarded: true,
      profile: null,
      targets: data.targets,
      customFoods: [],
      entries: [],
      favorites: [],
      recentFoodIds: [],
      settings: { theme: 'dark', units: 'metric' }
    };

    const result = parseLegacyState(JSON.stringify({ state: v1, version: 1 }));
    expect(result?.schemaVersion).toBe(3);
    expect(result?.settings.waterGoalMl).toBe(2000);
    expect(result?.reminders.items).toHaveLength(4);
  });

  it('rejects malformed or empty values', () => {
    expect(parseLegacyState(null)).toBeNull();
    expect(parseLegacyState('not json')).toBeNull();
    expect(parseLegacyState(JSON.stringify({ state: { schemaVersion: 99 } }))).toBeNull();
  });
});
