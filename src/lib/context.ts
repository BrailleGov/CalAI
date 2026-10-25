import type { Entry, PersistedData, WaterEntry, WeightEntry } from '../types';
import { lastNDayKeys, todayKey } from './dates';
import { entriesForDate, sumEntries } from './nutrition';
import { muscleFocusSummary } from './preferences';

export type ContextWindow = {
  days: number;
  kcalPerDay: number;
  proteinPerDay: number;
  carbsPerDay: number;
  fatPerDay: number;
  loggedDays: number;
};

export type AssistantContext = {
  today: string;
  goal: string;
  targets: { kcal: number; protein: number; carbs: number; fat: number };
  body: {
    weightKg: number | null;
    targetWeightKg: number | null;
    rateKgPerWeek: number | null;
    activity: string | null;
  };
  preferences: {
    diet: string;
    cuisines: string[];
    avoidIngredients: string[];
    trackingStyle: string;
  };
  trainingFocus: string[];
  windows: ContextWindow[];
  recentFoods: string[];
  weight: { latestKg: number | null; average7Kg: number | null };
  water: { average7Ml: number };
  reminderMeals: string[];
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function windowFor(entries: Entry[], days: number, end: string): ContextWindow {
  const keys = lastNDayKeys(days, end);
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let loggedDays = 0;

  for (const key of keys) {
    const dayEntries = entriesForDate(entries, key);
    if (dayEntries.length === 0) continue;
    const totals = sumEntries(dayEntries);
    kcal += totals.kcal;
    protein += totals.protein;
    carbs += totals.carbs;
    fat += totals.fat;
    loggedDays += 1;
  }

  return {
    days,
    kcalPerDay: loggedDays > 0 ? round(kcal / loggedDays) : 0,
    proteinPerDay: loggedDays > 0 ? round(protein / loggedDays) : 0,
    carbsPerDay: loggedDays > 0 ? round(carbs / loggedDays) : 0,
    fatPerDay: loggedDays > 0 ? round(fat / loggedDays) : 0,
    loggedDays
  };
}

function latestWeight(weights: WeightEntry[]): number | null {
  if (weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1]?.kg ?? null;
}

function averageWeight(weights: WeightEntry[], end: string): number | null {
  const keys = new Set(lastNDayKeys(7, end));
  const recent = weights.filter((item) => keys.has(item.date));
  if (recent.length === 0) return null;
  return round(recent.reduce((total, item) => total + item.kg, 0) / recent.length);
}

function averageWater(water: WaterEntry[], end: string): number {
  const keys = new Set(lastNDayKeys(7, end));
  const recent = water.filter((item) => keys.has(item.date));
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((total, item) => total + item.ml, 0) / 7);
}

export function buildAssistantContext(
  state: PersistedData,
  end = todayKey()
): AssistantContext {
  const recentFoods = [
    ...new Set(
      state.entries
        .filter((entry) => lastNDayKeys(14, end).includes(entry.date))
        .map((entry) => entry.name)
    )
  ].slice(-12);

  const targets = {
    kcal: state.targets.kcal,
    protein: state.targets.protein,
    carbs: state.targets.carbs,
    fat: state.targets.fat
  };

  return {
    today: end,
    goal: state.profile?.goal ?? 'maintain',
    targets,
    body: {
      weightKg: state.profile?.weightKg ?? null,
      targetWeightKg: state.profile?.targetWeightKg ?? null,
      rateKgPerWeek: state.profile?.rateKgPerWeek ?? null,
      activity: state.profile?.activity ?? null
    },
    preferences: {
      diet: state.preferences.diet,
      cuisines: state.preferences.cuisines,
      avoidIngredients: state.preferences.avoidIngredients,
      trackingStyle: state.preferences.trackingStyle
    },
    trainingFocus: muscleFocusSummary(state.profile),
    windows: [7, 14, 30].map((days) => windowFor(state.entries, days, end)),
    recentFoods,
    weight: {
      latestKg: latestWeight(state.weights),
      average7Kg: averageWeight(state.weights, end)
    },
    water: { average7Ml: averageWater(state.water, end) },
    reminderMeals: state.reminders.items
      .filter((item) => item.enabled)
      .map((item) => item.meal)
  };
}
