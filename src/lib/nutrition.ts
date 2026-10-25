import type {
  ActivityLevel,
  Entry,
  Meal,
  Nutrients,
  Profile,
  Targets
} from '../types';

export const MIN_CALORIES = 1200;
export const MAX_CALORIES = 6000;

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0
};

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

const SEX_OFFSET = {
  female: -161,
  male: 5,
  unspecified: -78
} as const;

export function scaleNutrients(nutrients: Nutrients, quantity: number): Nutrients {
  return {
    kcal: nutrients.kcal * quantity,
    protein: nutrients.protein * quantity,
    carbs: nutrients.carbs * quantity,
    fat: nutrients.fat * quantity
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat
  };
}

export function entryNutrients(entry: Entry): Nutrients {
  return scaleNutrients(entry.nutrients, entry.quantity);
}

export function sumEntries(entries: Entry[]): Nutrients {
  return entries.reduce<Nutrients>(
    (total, entry) => addNutrients(total, entryNutrients(entry)),
    EMPTY_NUTRIENTS
  );
}

export function entriesForDate(entries: Entry[], date: string): Entry[] {
  return entries.filter((entry) => entry.date === date);
}

export function entriesForMeal(entries: Entry[], date: string, meal: Meal): Entry[] {
  return entries.filter((entry) => entry.date === date && entry.meal === meal);
}

export function totalsForDate(entries: Entry[], date: string): Nutrients {
  return sumEntries(entriesForDate(entries, date));
}

export function totalsForMeal(entries: Entry[], date: string, meal: Meal): Nutrients {
  return sumEntries(entriesForMeal(entries, date, meal));
}

export function basalMetabolicRate(profile: Profile): number {
  const { weightKg, heightCm, age, sex } = profile;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_OFFSET[sex];
}

export function maintenanceCalories(profile: Profile): number {
  return basalMetabolicRate(profile) * ACTIVITY_FACTORS[profile.activity];
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

export function calculateTargets(profile: Profile): Targets {
  const maintenance = maintenanceCalories(profile);
  const direction = profile.goal === 'lose' ? -1 : profile.goal === 'gain' ? 1 : 0;
  const adjustment =
    direction === 0 ? 0 : direction * ((profile.rateKgPerWeek * 7700) / 7);

  const kcal = Math.min(
    MAX_CALORIES,
    Math.max(MIN_CALORIES, roundToTen(maintenance + adjustment))
  );

  const protein = Math.max(0, Math.round(profile.weightKg * 1.6));
  const fat = Math.max(0, Math.round((kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { kcal, protein, carbs, fat };
}

export function macroCalories(targets: Targets): number {
  return targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
}

export function remainingCalories(targets: Targets, consumed: Nutrients): number {
  return targets.kcal - consumed.kcal;
}
