import { MEALS, SCHEMA_VERSION } from '../types';
import type {
  BackupFile,
  Entry,
  Food,
  Nutrients,
  PersistedData,
  Profile,
  Recipe,
  RecipeIngredient,
  Reminder,
  ReminderSettings,
  Settings,
  Targets,
  WaterEntry,
  WeightEntry
} from '../types';
import { DEFAULT_REMINDER_SETTINGS } from '../types';
import { isValidDayKey } from './dates';

const FOOD_SOURCES = ['seed', 'custom', 'off', 'usda', 'recipe'] as const;
const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;
const SEXES = ['female', 'male', 'unspecified'] as const;
const THEMES = ['dark', 'light', 'system'] as const;
const UNIT_OPTIONS = ['metric', 'imperial'] as const;
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
    (value.servingGrams === undefined || isNumber(value.servingGrams, 0, 100000))
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

function isProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return (
    SEXES.includes(value.sex as (typeof SEXES)[number]) &&
    isNumber(value.age, 1, 120) &&
    isNumber(value.heightCm, 50, 300) &&
    isNumber(value.weightKg, 10, 500) &&
    ACTIVITIES.includes(value.activity as (typeof ACTIVITIES)[number]) &&
    GOALS.includes(value.goal as (typeof GOALS)[number]) &&
    isNumber(value.rateKgPerWeek, 0, 2)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
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
    isNumber(value.updatedAt, 0, Number.MAX_SAFE_INTEGER)
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

function migrateV1(value: Record<string, unknown>): PersistedData {
  const settings = value.settings as { theme: Settings['theme']; units: Settings['units'] };
  return {
    schemaVersion: SCHEMA_VERSION,
    onboarded: value.onboarded as boolean,
    profile: value.profile as Profile | null,
    targets: value.targets as Targets,
    customFoods: value.customFoods as Food[],
    remoteFoods: [],
    entries: value.entries as Entry[],
    favorites: value.favorites as string[],
    recentFoodIds: value.recentFoodIds as string[],
    recipes: [],
    weights: [],
    water: [],
    reminders: {
      ...DEFAULT_REMINDER_SETTINGS,
      items: DEFAULT_REMINDER_SETTINGS.items.map((item) => ({ ...item }))
    },
    settings: { ...settings, waterGoalMl: 2000 }
  };
}

function validateV2(value: Record<string, unknown>): Result {
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

  return { ok: true, data: value as unknown as PersistedData };
}

export function validatePersistedData(value: unknown): Result {
  if (!isRecord(value)) {
    return { ok: false, error: 'Backup data is not an object.' };
  }

  if (value.schemaVersion === 1) {
    const baseError = validateBaseFields(value, 1);
    if (baseError) return { ok: false, error: baseError };
    return { ok: true, data: migrateV1(value) };
  }

  if (value.schemaVersion === SCHEMA_VERSION) {
    return validateV2(value);
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
