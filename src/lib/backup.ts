import { MEALS } from '../types';
import type {
  BackupFile,
  Entry,
  Food,
  Nutrients,
  PersistedData,
  Profile,
  Targets
} from '../types';
import { isValidDayKey } from './dates';

const FOOD_SOURCES = ['seed', 'custom', 'off', 'usda'] as const;
const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const GOALS = ['lose', 'maintain', 'gain'] as const;
const SEXES = ['female', 'male', 'unspecified'] as const;
const THEMES = ['dark', 'light', 'system'] as const;
const UNIT_OPTIONS = ['metric', 'imperial'] as const;

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

export function validatePersistedData(value: unknown): Result {
  if (!isRecord(value)) {
    return { ok: false, error: 'Backup data is not an object.' };
  }

  if (value.schemaVersion !== 1) {
    return { ok: false, error: 'Unsupported backup version.' };
  }

  if (typeof value.onboarded !== 'boolean') {
    return { ok: false, error: 'Missing onboarding state.' };
  }

  if (value.profile !== null && !isProfile(value.profile)) {
    return { ok: false, error: 'Profile is invalid.' };
  }

  if (!isTargets(value.targets)) {
    return { ok: false, error: 'Targets are invalid.' };
  }

  if (!Array.isArray(value.customFoods) || !value.customFoods.every(isFood)) {
    return { ok: false, error: 'Custom foods are invalid.' };
  }

  if (!Array.isArray(value.entries) || !value.entries.every(isEntry)) {
    return { ok: false, error: 'Diary entries are invalid.' };
  }

  if (!isStringArray(value.favorites) || !isStringArray(value.recentFoodIds)) {
    return { ok: false, error: 'Favorites are invalid.' };
  }

  if (!isRecord(value.settings)) {
    return { ok: false, error: 'Settings are invalid.' };
  }

  if (!THEMES.includes(value.settings.theme as (typeof THEMES)[number])) {
    return { ok: false, error: 'Theme setting is invalid.' };
  }

  if (!UNIT_OPTIONS.includes(value.settings.units as (typeof UNIT_OPTIONS)[number])) {
    return { ok: false, error: 'Unit setting is invalid.' };
  }

  return { ok: true, data: value as unknown as PersistedData };
}

export function buildBackup(data: PersistedData): BackupFile {
  return {
    app: 'calai',
    schemaVersion: 1,
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
