import { describe, expect, it } from 'vitest';
import type { PersistedData } from '../types';
import {
  buildBackup,
  parseBackup,
  redactForExport,
  validatePersistedData
} from './backup';

const data: PersistedData = {
  schemaVersion: 3,
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
  remoteFoods: [],
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
  settings: { theme: 'system', units: 'metric', waterGoalMl: 2000 },
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
    const result = validatePersistedData({ ...data, schemaVersion: 99 });
    expect(result.ok).toBe(false);
  });

  it('migrates a v0.1 backup to the current schema', () => {
    const v1 = {
      ...data,
      schemaVersion: 1,
      settings: { theme: 'dark', units: 'imperial' }
    };
    delete (v1 as Record<string, unknown>).remoteFoods;
    delete (v1 as Record<string, unknown>).recipes;
    delete (v1 as Record<string, unknown>).weights;
    delete (v1 as Record<string, unknown>).water;
    delete (v1 as Record<string, unknown>).reminders;

    const result = validatePersistedData(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.settings.waterGoalMl).toBe(2000);
      expect(result.data.reminders.items).toHaveLength(4);
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.preferences.diet).toBe('no_preference');
    }
  });

  it('migrates a v0.2 backup and fills personalization defaults', () => {
    const v2 = {
      ...data,
      schemaVersion: 2
    };
    delete (v2 as Record<string, unknown>).preferences;
    delete (v2 as Record<string, unknown>).sms;
    delete (v2 as Record<string, unknown>).cloudSync;
    delete (v2 as Record<string, unknown>).chatMessages;

    const result = validatePersistedData(v2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.preferences.trackingStyle).toBe('detailed');
      expect(result.data.sms.enabled).toBe(false);
      expect(result.data.cloudSync.enabled).toBe(false);
      expect(result.data.chatMessages).toEqual([]);
      expect(result.data.entries).toHaveLength(1);
    }
  });

  it('excludes phone numbers from exported backups', () => {
    const redacted = redactForExport({
      ...data,
      sms: { enabled: true, phone: '+15551234567', consentAt: 10 }
    });
    expect(redacted.sms.phone).toBe('');
    expect(redacted.sms.enabled).toBe(false);
    expect(redacted.entries).toHaveLength(1);
  });
});
