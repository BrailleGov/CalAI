export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks'
};

export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const SCHEMA_VERSION = 2 as const;

export type FoodSource = 'seed' | 'custom' | 'off' | 'usda' | 'recipe';

export type Food = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingLabel: string;
  servingGrams?: number;
  nutrients: Nutrients;
  source: FoodSource;
  createdAt: number;
};

export type Entry = {
  id: string;
  date: string;
  meal: Meal;
  foodId?: string;
  name: string;
  servingLabel: string;
  quantity: number;
  nutrients: Nutrients;
  createdAt: number;
};

export type Targets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Sex = 'female' | 'male' | 'unspecified';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  rateKgPerWeek: number;
};

export type ThemeSetting = 'dark' | 'light' | 'system';

export type Units = 'metric' | 'imperial';

export type Settings = {
  theme: ThemeSetting;
  units: Units;
  waterGoalMl: number;
};

export type RecipeIngredient = {
  foodId?: string;
  name: string;
  servingLabel: string;
  quantity: number;
  nutrients: Nutrients;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  createdAt: number;
  updatedAt: number;
};

export type WeightEntry = {
  id: string;
  date: string;
  kg: number;
  createdAt: number;
};

export type WaterEntry = {
  id: string;
  date: string;
  ml: number;
  createdAt: number;
};

export type Reminder = {
  id: string;
  meal: Meal;
  time: string;
  enabled: boolean;
};

export type ReminderSettings = {
  enabled: boolean;
  quietStart: string;
  quietEnd: string;
  items: Reminder[];
};

export type PersistedData = {
  schemaVersion: typeof SCHEMA_VERSION;
  onboarded: boolean;
  profile: Profile | null;
  targets: Targets;
  customFoods: Food[];
  remoteFoods: Food[];
  entries: Entry[];
  favorites: string[];
  recentFoodIds: string[];
  recipes: Recipe[];
  weights: WeightEntry[];
  water: WaterEntry[];
  reminders: ReminderSettings;
  settings: Settings;
};

export type BackupFile = {
  app: 'calai';
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  data: PersistedData;
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Very active',
  very_active: 'Extremely active'
};

export const ACTIVITY_HINTS: Record<ActivityLevel, string> = {
  sedentary: 'Desk job, little exercise',
  light: 'Light exercise 1–3 days a week',
  moderate: 'Moderate exercise 3–5 days a week',
  active: 'Hard exercise 6–7 days a week',
  very_active: 'Physical job or twice-daily training'
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose weight',
  maintain: 'Maintain',
  gain: 'Gain weight'
};

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  unspecified: 'Prefer not to say'
};

export const FOOD_SOURCE_LABELS: Record<FoodSource, string> = {
  seed: '',
  custom: 'custom',
  off: 'Open Food Facts',
  usda: 'USDA',
  recipe: 'recipe'
};

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'breakfast', meal: 'breakfast', time: '08:00', enabled: false },
  { id: 'lunch', meal: 'lunch', time: '12:30', enabled: false },
  { id: 'dinner', meal: 'dinner', time: '18:30', enabled: false },
  { id: 'snack', meal: 'snack', time: '15:30', enabled: false }
];

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  quietStart: '21:00',
  quietEnd: '07:00',
  items: DEFAULT_REMINDERS
};
