import { describe, expect, it } from 'vitest';
import {
  muscleFocusSummary,
  normalizeChatMessages,
  normalizePreferences,
  normalizeProfile,
  normalizeSms
} from './preferences';

const profile = {
  sex: 'female' as const,
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activity: 'light' as const,
  goal: 'lose' as const,
  rateKgPerWeek: 0.5
};

describe('preferences', () => {
  it('fills missing values with safe defaults', () => {
    const result = normalizePreferences({});
    expect(result.trackingStyle).toBe('detailed');
    expect(result.aiConsentAt).toBeNull();
    expect(result.diet).toBe('no_preference');
    expect(result.avoidIngredients).toEqual([]);
  });

  it('keeps only valid cuisines and cleans avoid terms', () => {
    const result = normalizePreferences({
      cuisines: ['Asian', 'Made up', 'Asian'],
      avoidIngredients: [' peanuts ', 'x', 'shellfish', 'peanuts']
    });
    expect(result.cuisines).toEqual(['Asian']);
    expect(result.avoidIngredients).toEqual(['peanuts', 'shellfish']);
  });

  it('drops invalid AI consent timestamps', () => {
    expect(normalizePreferences({ aiConsentAt: -1 }).aiConsentAt).toBeNull();
    expect(normalizePreferences({ aiConsentAt: 123 }).aiConsentAt).toBe(123);
  });

  it('normalizes SMS settings without enabling them silently', () => {
    expect(normalizeSms({})).toEqual({ enabled: false, phone: '', consentAt: null });
    expect(normalizeSms({ enabled: true, phone: ' +15551234567 ', consentAt: 5 })).toEqual({
      enabled: true,
      phone: '+15551234567',
      consentAt: 5
    });
  });

  it('caps assistant history at 60 messages', () => {
    const messages = Array.from({ length: 80 }, (_, index) => ({
      id: `m-${index}`,
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `message ${index}`,
      createdAt: index
    }));
    const result = normalizeChatMessages(messages);
    expect(result).toHaveLength(60);
    expect(result[0]?.content).toBe('message 20');
  });

  it('drops invalid muscle values and target weights in profiles', () => {
    const result = normalizeProfile(
      {
        ...profile,
        targetWeightKg: 5,
        muscleFocus: { chest: 120, back: 40, madeUp: 20 }
      },
      profile
    );
    expect(result.targetWeightKg).toBeUndefined();
    expect(result.muscleFocus).toEqual({ back: 40 });
    expect(muscleFocusSummary(result)).toEqual(['Back 40%']);
  });
});
