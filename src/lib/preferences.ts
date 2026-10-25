import {
  CUISINE_OPTIONS,
  DEFAULT_PREFERENCES,
  DIET_PATTERNS,
  MUSCLE_GROUPS,
  TRACKING_STYLES
} from '../types';
import type {
  ChatMessage,
  CloudSyncSettings,
  MuscleFocus,
  Preferences,
  Profile,
  SmsPreferences
} from '../types';

const MAX_AVOID = 20;
const MAX_CUISINES = 6;

export function normalizePreferences(value: unknown): Preferences {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const trackingStyle = TRACKING_STYLES.includes(record.trackingStyle as never)
    ? (record.trackingStyle as Preferences['trackingStyle'])
    : DEFAULT_PREFERENCES.trackingStyle;
  const diet = DIET_PATTERNS.includes(record.diet as never)
    ? (record.diet as Preferences['diet'])
    : DEFAULT_PREFERENCES.diet;

  const avoidIngredients = Array.isArray(record.avoidIngredients)
    ? record.avoidIngredients
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 40)
        .slice(0, MAX_AVOID)
    : [];

  const cuisines = Array.isArray(record.cuisines)
    ? record.cuisines
        .filter(
          (item): item is string =>
            typeof item === 'string' && (CUISINE_OPTIONS as readonly string[]).includes(item)
        )
        .slice(0, MAX_CUISINES)
    : [];

  return {
    trackingStyle,
    photoLogging:
      typeof record.photoLogging === 'boolean'
        ? record.photoLogging
        : DEFAULT_PREFERENCES.photoLogging,
    textLogging:
      typeof record.textLogging === 'boolean'
        ? record.textLogging
        : DEFAULT_PREFERENCES.textLogging,
    aiChat:
      typeof record.aiChat === 'boolean' ? record.aiChat : DEFAULT_PREFERENCES.aiChat,
    recipeIdeas:
      typeof record.recipeIdeas === 'boolean'
        ? record.recipeIdeas
        : DEFAULT_PREFERENCES.recipeIdeas,
    aiConsentAt:
      typeof record.aiConsentAt === 'number' &&
      Number.isFinite(record.aiConsentAt) &&
      record.aiConsentAt > 0
        ? record.aiConsentAt
        : null,
    diet,
    avoidIngredients: [...new Set(avoidIngredients)],
    cuisines: [...new Set(cuisines)]
  };
}

export function normalizeSms(value: unknown): SmsPreferences {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    enabled: record.enabled === true,
    phone: typeof record.phone === 'string' ? record.phone.trim().slice(0, 24) : '',
    consentAt:
      typeof record.consentAt === 'number' &&
      Number.isFinite(record.consentAt) &&
      record.consentAt > 0
        ? record.consentAt
        : null,
    ...(typeof record.lastTestAt === 'number' && Number.isFinite(record.lastTestAt)
      ? { lastTestAt: record.lastTestAt }
      : {})
  };
}

export function normalizeCloudSync(value: unknown): CloudSyncSettings {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    enabled: record.enabled === true,
    lastSyncedAt:
      typeof record.lastSyncedAt === 'number' &&
      Number.isFinite(record.lastSyncedAt) &&
      record.lastSyncedAt > 0
        ? record.lastSyncedAt
        : null
  };
}

export function normalizeChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .flatMap((item): ChatMessage[] => {
      if (
        typeof item.id !== 'string' ||
        (item.role !== 'user' && item.role !== 'assistant') ||
        typeof item.content !== 'string'
      ) {
        return [];
      }
      const content = item.content.trim().slice(0, 4000);
      if (!content) return [];
      return [
        {
          id: item.id.slice(0, 80),
          role: item.role,
          content,
          createdAt:
            typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
              ? item.createdAt
              : Date.now(),
          ...(typeof item.window === 'string' && item.window.trim()
            ? { window: item.window.trim().slice(0, 80) }
            : {}),
          ...(item.error === true ? { error: true } : {})
        }
      ];
    })
    .slice(-60);
}

export function normalizeMuscleFocus(value: unknown): MuscleFocus | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const focus: MuscleFocus = {};
  let any = false;

  for (const group of MUSCLE_GROUPS) {
    const raw = record[group];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100) {
      focus[group] = Math.round(raw);
      if (raw > 0) any = true;
    }
  }

  return any ? focus : undefined;
}

export function normalizeProfile(value: unknown, fallback: Profile): Profile {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const targetWeightKg =
    typeof record.targetWeightKg === 'number' &&
    Number.isFinite(record.targetWeightKg) &&
    record.targetWeightKg >= 30 &&
    record.targetWeightKg <= 300
      ? record.targetWeightKg
      : undefined;
  const muscleFocus = normalizeMuscleFocus(record.muscleFocus);

  return {
    sex:
      record.sex === 'female' || record.sex === 'male' || record.sex === 'unspecified'
        ? record.sex
        : fallback.sex,
    age:
      typeof record.age === 'number' && Number.isFinite(record.age)
        ? record.age
        : fallback.age,
    heightCm:
      typeof record.heightCm === 'number' && Number.isFinite(record.heightCm)
        ? record.heightCm
        : fallback.heightCm,
    weightKg:
      typeof record.weightKg === 'number' && Number.isFinite(record.weightKg)
        ? record.weightKg
        : fallback.weightKg,
    activity:
      record.activity === 'sedentary' ||
      record.activity === 'light' ||
      record.activity === 'moderate' ||
      record.activity === 'active' ||
      record.activity === 'very_active'
        ? record.activity
        : fallback.activity,
    goal:
      record.goal === 'lose' || record.goal === 'maintain' || record.goal === 'gain'
        ? record.goal
        : fallback.goal,
    rateKgPerWeek:
      typeof record.rateKgPerWeek === 'number' && Number.isFinite(record.rateKgPerWeek)
        ? Math.min(2, Math.max(0, record.rateKgPerWeek))
        : fallback.rateKgPerWeek,
    ...(targetWeightKg !== undefined ? { targetWeightKg } : {}),
    ...(muscleFocus !== undefined ? { muscleFocus } : {})
  };
}

export function muscleFocusSummary(profile: Profile | null): string[] {
  if (!profile?.muscleFocus) return [];
  const entries = MUSCLE_GROUPS.flatMap((group) => {
    const value = profile.muscleFocus?.[group];
    return typeof value === 'number' && value > 0 ? [{ group, value }] : [];
  });
  entries.sort((a, b) => b.value - a.value);
  return entries.slice(0, 3).map((entry) => {
    const label = entry.group.charAt(0).toUpperCase() + entry.group.slice(1);
    return `${label} ${entry.value}%`;
  });
}

export function preferenceLines(preferences: Preferences): string[] {
  const lines = [`Logging style: ${preferences.trackingStyle}`];
  if (preferences.diet !== 'no_preference') lines.push(`Diet: ${preferences.diet}`);
  if (preferences.cuisines.length > 0) {
    lines.push(`Preferred cuisines: ${preferences.cuisines.join(', ')}`);
  }
  if (preferences.avoidIngredients.length > 0) {
    lines.push(`Avoid ingredients: ${preferences.avoidIngredients.join(', ')}`);
  }
  return lines;
}
