import { MEALS, SCHEMA_VERSION } from '../types';
import type {
  BackupFile,
  ChatMessage,
  CloudSyncSettings,
  Entry,
  Food,
  FoodCategory,
  MuscleFocus,
  Nutrients,
  PersistedData,
  Preferences,
  Profile,
  Recipe,
  RecipeIngredient,
  RecipeSource,
  Reminder,
  ReminderSettings,
  Settings,
  SmsPreferences,
  Targets,
  WaterEntry,
  WeightEntry
} from '../types';
import { DEFAULT_REMINDER_SETTINGS } from '../types';
import {
  normalizeChatMessages,
  normalizeCloudSync,
  normalizeMuscleFocus,
  normalizePreferences,
  normalizeSms
} from './preferences';
import { isValidDayKey } from './dates';

const FOOD_SOURCES = ['seed', 'custom', 'off', 'usda', 'recipe'] as const;
const FOOD_CATEGORY_VALUES = [
  'protein',
  'dairy',
  'grains',
  'fruit',
  'vegetables',
  'fats',
  'drinks',
  'meals',
  'snacks',
  'condiments'
] as const;
const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;
const SEXES = ['female', 'male', 'unspecified'] as const;
const THEMES = ['dark', 'light', 'system'] as const;
const UNIT_OPTIONS = ['metric', 'imperial'] as const;
const TRACKING_STYLES = ['quick', 'detailed'] as const;
const DIET_PATTERNS = [
  'no_preference',
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'other'
] as const;
const RECIPE_SOURCES = ['user', 'ai', 'curated'] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Result = { ok: true; data: PersistedData } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

function isNutrients(value: unknown, maxKcal = 20000): value is Nutrients {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.kcal, 0, maxKcal) &&
    isNumber(value.protein, 0, 2000) &&
    isNumber(value.carbs, 0, 2000) &&
    isNumber(value.fat, 0, 2000)
  );
}

function isFood(value: unknown): value is Food {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.name) &&
    isText(value.servingLabel) &&
    isNutrients(value.nutrients) &&
    FOOD_SOURCES.includes(value.source as (typeof FOOD_SOURCES)[number]) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    (value.brand === undefined || typeof value.brand === 'string') &&
    (value.barcode === undefined || typeof value.barcode === 'string') &&
    (value.servingGrams === undefined || isNumber(value.servingGrams, 0, 100000)) &&
    (value.category === undefined ||
      FOOD_CATEGORY_VALUES.includes(value.category as FoodCategory))
  );
}

function isEntry(value: unknown): value is Entry {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    typeof value.date === 'string' &&
    isValidDayKey(value.date) &&
    MEALS.includes(value.meal as (typeof MEALS)[number]) &&
    isText(value.name) &&
    isText(value.servingLabel) &&
    isNumber(value.quantity, 0.01, 1000) &&
    isNutrients(value.nutrients) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    (value.foodId === undefined || typeof value.foodId === 'string')
  );
}

function isTargets(value: unknown): value is Targets {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.kcal, 0, 20000) &&
    isNumber(value.protein, 0, 2000) &&
    isNumber(value.carbs, 0, 2000) &&
    isNumber(value.fat, 0, 2000)
  );
}

function isMuscleFocus(value: unknown): value is MuscleFocus {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, entry]) =>
      ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs'].includes(key) &&
      isNumber(entry, 0, 100)
  );
}

function isProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return (
    SEXES.includes(value.sex as (typeof SEXES)[number]) &&
    isNumber(value.age, 1, 120) &&
    isNumber(value.heightCm, 50, 300) &&
    isNumber(value.weightKg, 10, 500) &&
    ACTIVITIES.includes(value.activity as (typeof ACTIVITIES)[number]) &&
    GOALS.includes(value.goal as (typeof GOALS)[number]) &&
    isNumber(value.rateKgPerWeek, 0, 2) &&
    (value.targetWeightKg === undefined || isNumber(value.targetWeightKg, 30, 300)) &&
    isMuscleFocus(value.muscleFocus)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPreferences(value: unknown): value is Preferences {
  if (!isRecord(value)) return false;
  return (
    TRACKING_STYLES.includes(value.trackingStyle as (typeof TRACKING_STYLES)[number]) &&
    typeof value.photoLogging === 'boolean' &&
    typeof value.textLogging === 'boolean' &&
    typeof value.aiChat === 'boolean' &&
    typeof value.recipeIdeas === 'boolean' &&
    (value.aiConsentAt === null || isNumber(value.aiConsentAt, 1, Number.MAX_SAFE_INTEGER)) &&
    DIET_PATTERNS.includes(value.diet as (typeof DIET_PATTERNS)[number]) &&
    isStringArray(value.avoidIngredients) &&
    value.avoidIngredients.length <= 20 &&
    value.avoidIngredients.every((item) => item.length >= 2 && item.length <= 40) &&
    isStringArray(value.cuisines) &&
    value.cuisines.length <= 6 &&
    value.cuisines.every((item) => item.length >= 2 && item.length <= 40)
  );
}

function isSms(value: unknown): value is SmsPreferences {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    typeof value.phone === 'string' &&
    value.phone.length <= 24 &&
    (value.consentAt === null || isNumber(value.consentAt, 1, Number.MAX_SAFE_INTEGER)) &&
    (value.lastTestAt === undefined ||
      isNumber(value.lastTestAt, 1, Number.MAX_SAFE_INTEGER))
  );
}

function isCloudSync(value: unknown): value is CloudSyncSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    (value.lastSyncedAt === null ||
      isNumber(value.lastSyncedAt, 1, Number.MAX_SAFE_INTEGER))
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    (value.role === 'user' || value.role === 'assistant') &&
    isText(value.content, 4000) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    (value.window === undefined || typeof value.window === 'string') &&
    (value.error === undefined || typeof value.error === 'boolean')
  );
}

function isRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (!isRecord(value)) return false;
  return (
    (value.foodId === undefined || typeof value.foodId === 'string') &&
    isText(value.name) &&
    isText(value.servingLabel) &&
    isNumber(value.quantity, 0.01, 1000) &&
    isNutrients(value.nutrients)
  );
}

function isStringList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= maxItems &&
      value.every((item) => typeof item === 'string' && item.length <= maxLength))
  );
}

function isRecipe(value: unknown): value is Recipe {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    isText(value.name, 120) &&
    isNumber(value.servings, 0.25, 100) &&
    Array.isArray(value.ingredients) &&
    value.ingredients.length > 0 &&
    value.ingredients.length <= 100 &&
    value.ingredients.every(isRecipeIngredient) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
    isNumber(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) &&
    (value.description === undefined ||
      (typeof value.description === 'string' && value.description.length <= 1000)) &&
    isStringList(value.instructions, 30, 500) &&
    isStringList(value.tags, 12, 40) &&
    (value.source === undefined ||
      RECIPE_SOURCES.includes(value.source as RecipeSource))
  );
}

function isWeightEntry(value: unknown): value is WeightEntry {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    typeof value.date === 'string' &&
    isValidDayKey(value.date) &&
    isNumber(value.kg, 10, 500) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER)
  );
}

function isWaterEntry(value: unknown): value is WaterEntry {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    typeof value.date === 'string' &&
    isValidDayKey(value.date) &&
    isNumber(value.ml, 1, 5000) &&
    isNumber(value.createdAt, 0, Number.MAX_SAFE_INTEGER)
  );
}

function isReminder(value: unknown): value is Reminder {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    MEALS.includes(value.meal as (typeof MEALS)[number]) &&
    isTime(value.time) &&
    typeof value.enabled === 'boolean'
  );
}

function isReminderSettings(value: unknown): value is ReminderSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    isTime(value.quietStart) &&
    isTime(value.quietEnd) &&
    Array.isArray(value.items) &&
    value.items.length <= 12 &&
    value.items.every(isReminder)
  );
}

function isSettings(value: unknown, version: number): value is Settings {
  if (!isRecord(value)) return false;
  const base =
    THEMES.includes(value.theme as (typeof THEMES)[number]) &&
    UNIT_OPTIONS.includes(value.units as (typeof UNIT_OPTIONS)[number]);

  if (!base) return false;
  if (version === 1) return true;
  return isNumber(value.waterGoalMl, 250, 10000);
}

function validateBaseFields(value: Record<string, unknown>, version: number): string | null {
  if (typeof value.onboarded !== 'boolean') return 'Missing onboarding state.';
  if (value.profile !== null && !isProfile(value.profile)) return 'Profile is invalid.';
  if (!isTargets(value.targets)) return 'Targets are invalid.';
  if (!Array.isArray(value.customFoods) || !value.customFoods.every(isFood)) {
    return 'Custom foods are invalid.';
  }
  if (!Array.isArray(value.entries) || !value.entries.every(isEntry)) {
    return 'Diary entries are invalid.';
  }
  if (!isStringArray(value.favorites) || !isStringArray(value.recentFoodIds)) {
    return 'Favorites are invalid.';
  }
  if (!isSettings(value.settings, version)) return 'Settings are invalid.';
  return null;
}

function defaultReminders(): ReminderSettings {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    items: DEFAULT_REMINDER_SETTINGS.items.map((item) => ({ ...item }))
  };
}

function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
  const settings = value.settings as { theme: Settings['theme']; units: Settings['units'] };
  return {
    ...value,
    schemaVersion: 2,
    remoteFoods: [],
    recipes: [],
    weights: [],
    water: [],
    reminders: defaultReminders(),
    settings: { ...settings, waterGoalMl: 2000 }
  };
}

function migrateV2(value: Record<string, unknown>): PersistedData {
  const rawProfile = value.profile as Profile | null;
  const muscleFocus = rawProfile ? normalizeMuscleFocus(rawProfile.muscleFocus) : undefined;
  return {
    ...(value as unknown as PersistedData),
    schemaVersion: SCHEMA_VERSION,
    profile: rawProfile
      ? {
          ...rawProfile,
          ...(muscleFocus ? { muscleFocus } : {})
        }
      : null,
    preferences: normalizePreferences(value.preferences),
    sms: normalizeSms(value.sms),
    cloudSync: normalizeCloudSync(value.cloudSync),
    chatMessages: normalizeChatMessages(value.chatMessages)
  };
}

function validateCurrent(value: Record<string, unknown>): Result {
  const baseError = validateBaseFields(value, SCHEMA_VERSION);
  if (baseError) return { ok: false, error: baseError };

  if (!Array.isArray(value.remoteFoods) || !value.remoteFoods.every(isFood)) {
    return { ok: false, error: 'Remote foods are invalid.' };
  }
  if (!Array.isArray(value.recipes) || !value.recipes.every(isRecipe)) {
    return { ok: false, error: 'Recipes are invalid.' };
  }
  if (!Array.isArray(value.weights) || !value.weights.every(isWeightEntry)) {
    return { ok: false, error: 'Weight entries are invalid.' };
  }
  if (!Array.isArray(value.water) || !value.water.every(isWaterEntry)) {
    return { ok: false, error: 'Water entries are invalid.' };
  }
  if (!isReminderSettings(value.reminders)) {
    return { ok: false, error: 'Reminder settings are invalid.' };
  }
  if (!isPreferences(value.preferences)) {
    return { ok: false, error: 'Personalization preferences are invalid.' };
  }
  if (!isSms(value.sms)) {
    return { ok: false, error: 'SMS preferences are invalid.' };
  }
  if (!isCloudSync(value.cloudSync)) {
    return { ok: false, error: 'Cloud backup settings are invalid.' };
  }
  if (!Array.isArray(value.chatMessages) || !value.chatMessages.every(isChatMessage)) {
    return { ok: false, error: 'Assistant history is invalid.' };
  }

  return { ok: true, data: value as unknown as PersistedData };
}

export function validatePersistedData(value: unknown): Result {
  if (!isRecord(value)) {
    return { ok: false, error: 'Backup data is not an object.' };
  }

  if (value.schemaVersion === 1) {
    const baseError = validateBaseFields(value, 1);
    if (baseError) return { ok: false, error: baseError };
    return { ok: true, data: migrateV2(migrateV1(value)) };
  }

  if (value.schemaVersion === 2) {
    const baseError = validateBaseFields(value, 2);
    if (baseError) return { ok: false, error: baseError };
    if (!Array.isArray(value.remoteFoods) || !value.remoteFoods.every(isFood)) {
      return { ok: false, error: 'Remote foods are invalid.' };
    }
    if (!Array.isArray(value.recipes) || !value.recipes.every(isRecipe)) {
      return { ok: false, error: 'Recipes are invalid.' };
    }
    if (!Array.isArray(value.weights) || !value.weights.every(isWeightEntry)) {
      return { ok: false, error: 'Weight entries are invalid.' };
    }
    if (!Array.isArray(value.water) || !value.water.every(isWaterEntry)) {
      return { ok: false, error: 'Water entries are invalid.' };
    }
    if (!isReminderSettings(value.reminders)) {
      return { ok: false, error: 'Reminder settings are invalid.' };
    }
    return { ok: true, data: migrateV2(value) };
  }

  if (value.schemaVersion === SCHEMA_VERSION) {
    return validateCurrent(value);
  }

  return { ok: false, error: 'Unsupported backup version.' };
}

export function buildBackup(data: PersistedData): BackupFile {
  return {
    app: 'calai',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
}

/** Phone numbers are intentionally excluded from downloadable backups. */
export function redactForExport(data: PersistedData): PersistedData {
  return {
    ...data,
    sms: {
      enabled: false,
      phone: '',
      consentAt: null
    }
  };
}

export function parseBackup(text: string): Result {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!isRecord(parsed) || parsed.app !== 'calai') {
    return { ok: false, error: 'That file is not a CalAI backup.' };
  }

  return validatePersistedData(parsed.data);
}
