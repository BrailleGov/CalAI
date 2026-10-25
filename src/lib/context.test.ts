import { describe, expect, it } from 'vitest';
import type { PersistedData } from '../types';
import { addDays, todayKey } from './dates';
import { buildAssistantContext } from './context';

function makeData(): PersistedData {
  const today = todayKey();
  return {
    schemaVersion: 3,
    onboarded: true,
    profile: {
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activity: 'moderate',
      goal: 'maintain',
      rateKgPerWeek: 0,
      targetWeightKg: 78
    },
    targets: { kcal: 2400, protein: 130, carbs: 280, fat: 70 },
    customFoods: [],
    remoteFoods: [],
    entries: [
      {
        id: 'a',
        date: today,
        meal: 'lunch',
        name: 'Chicken bowl',
        servingLabel: '1 bowl',
        quantity: 1,
        nutrients: { kcal: 500, protein: 40, carbs: 50, fat: 15 },
        createdAt: 1
      },
      {
        id: 'b',
        date: addDays(today, -1),
        meal: 'dinner',
        name: 'Pasta',
        servingLabel: '1 plate',
        quantity: 1,
        nutrients: { kcal: 700, protein: 25, carbs: 90, fat: 20 },
        createdAt: 2
      }
    ],
    favorites: [],
    recentFoodIds: [],
    recipes: [],
    weights: [
      { id: 'w1', date: addDays(today, -2), kg: 79.5, createdAt: 1 },
      { id: 'w2', date: today, kg: 80.2, createdAt: 2 }
    ],
    water: [{ id: 'wa', date: today, ml: 700, createdAt: 1 }],
    reminders: {
      enabled: true,
      quietStart: '21:00',
      quietEnd: '07:00',
      items: [
        { id: 'lunch', meal: 'lunch', time: '12:30', enabled: true },
        { id: 'dinner', meal: 'dinner', time: '18:30', enabled: false }
      ]
    },
    settings: { theme: 'dark', units: 'metric', waterGoalMl: 2000 },
    preferences: {
      trackingStyle: 'quick',
      photoLogging: true,
      textLogging: true,
      aiChat: true,
      recipeIdeas: true,
      aiConsentAt: 10,
      diet: 'vegetarian',
      avoidIngredients: ['peanuts'],
      cuisines: ['Asian']
    },
    sms: { enabled: false, phone: '', consentAt: null },
    cloudSync: { enabled: false, lastSyncedAt: null },
    chatMessages: []
  };
}

describe('assistant context', () => {
  it('summarizes windows without shipping raw entries', () => {
    const context = buildAssistantContext(makeData());
    expect(context.windows[0]?.kcalPerDay).toBe(600);
    expect(context.windows[0]?.loggedDays).toBe(2);
    expect(context.windows[2]?.kcalPerDay).toBe(600);
    expect(context.targets.kcal).toBe(2400);
    expect(context.recentFoods).toEqual(['Chicken bowl', 'Pasta']);
    expect(context.weight.latestKg).toBe(80.2);
    expect(context.weight.average7Kg).toBe(79.9);
    expect(context.reminderMeals).toEqual(['lunch']);
    expect(JSON.stringify(context)).not.toContain('servingLabel');
  });

  it('reports missing data honestly', () => {
    const data = makeData();
    data.entries = [];
    data.weights = [];
    const context = buildAssistantContext(data);
    expect(context.windows[0]?.loggedDays).toBe(0);
    expect(context.windows[0]?.kcalPerDay).toBe(0);
    expect(context.weight.latestKg).toBeNull();
  });
});
