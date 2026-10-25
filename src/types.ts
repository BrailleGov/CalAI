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

export const SCHEMA_VERSION = 3 as const;

export const FOOD_CATEGORIES = [
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

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: 'Protein',
  dairy: 'Dairy & eggs',
  grains: 'Grains & legumes',
  fruit: 'Fruit',
  vegetables: 'Vegetables',
  fats: 'Fats & nuts',
  drinks: 'Drinks',
  meals: 'Meals',
  snacks: 'Snacks',
  condiments: 'Sauces & extras'
};

export type FoodSource = 'seed' | 'custom' | 'off' | 'usda' | 'recipe' | 'ai';

export type Food = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingLabel: string;
  servingGrams?: number;
  nutrients: Nutrients;
  source: FoodSource;
  /** True when an AI estimate was reconciled against current web results. */
  web?: boolean;
  createdAt: number;
  category?: FoodCategory;
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

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'glutes',
  'legs'
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  glutes: 'Glutes',
  legs: 'Legs'
};

/**
 * Optional training emphasis, 0–100 per group. This is a preference for recipe and
 * coaching language, not a body measurement or a medical target.
 */
export type MuscleFocus = Partial<Record<MuscleGroup, number>>;

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  rateKgPerWeek: number;
  /** Optional target the user chose to set. Never inferred. */
  targetWeightKg?: number;
  /** Optional training emphasis chosen with sliders. */
  muscleFocus?: MuscleFocus;
};

export type ThemeSetting = 'dark' | 'light' | 'system';

export type Units = 'metric' | 'imperial';

export type Settings = {
  theme: ThemeSetting;
  units: Units;
  waterGoalMl: number;
};

/** Canadian defaults: dark theme and pounds/feet for body measurements. */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  units: 'imperial',
  waterGoalMl: 2000
};

export const TRACKING_STYLES = ['quick', 'detailed'] as const;
export type TrackingStyle = (typeof TRACKING_STYLES)[number];

export const TRACKING_STYLE_LABELS: Record<TrackingStyle, string> = {
  quick: 'One-tap logging',
  detailed: 'Full diary and macros'
};

export const DIET_PATTERNS = [
  'no_preference',
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'other'
] as const;

export type DietPattern = (typeof DIET_PATTERNS)[number];

export const DIET_LABELS: Record<DietPattern, string> = {
  no_preference: 'No preference',
  omnivore: 'Omnivore',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  halal: 'Halal',
  kosher: 'Kosher',
  other: 'Other'
};

export const CUISINE_OPTIONS = [
  'Mediterranean',
  'Asian',
  'Indian',
  'Latin American',
  'Middle Eastern',
  'Italian',
  'Comfort food',
  'High protein',
  'Vegetarian',
  'Quick meals'
] as const;

export type Preferences = {
  trackingStyle: TrackingStyle;
  photoLogging: boolean;
  textLogging: boolean;
  aiChat: boolean;
  recipeIdeas: boolean;
  /** Epoch ms of explicit AI consent, or null when AI requests must not be sent. */
  aiConsentAt: number | null;
  diet: DietPattern;
  avoidIngredients: string[];
  cuisines: string[];
};

export type SmsPreferences = {
  enabled: boolean;
  phone: string;
  consentAt: number | null;
  lastTestAt?: number;
};

export type CloudSyncSettings = {
  enabled: boolean;
  lastSyncedAt: number | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  window?: string;
  error?: boolean;
};

export type RecipeIngredient = {
  foodId?: string;
  name: string;
  servingLabel: string;
  quantity: number;
  nutrients: Nutrients;
};

export type RecipeSource = 'user' | 'ai' | 'curated';

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  description?: string;
  instructions?: string[];
  tags?: string[];
  source?: RecipeSource;
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
  preferences: Preferences;
  sms: SmsPreferences;
  cloudSync: CloudSyncSettings;
  chatMessages: ChatMessage[];
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
  recipe: 'recipe',
  ai: 'AI estimate'
};

export function foodSourceLabel(food: Pick<Food, 'source' | 'web'>): string {
  return food.web ? 'Web + AI' : FOOD_SOURCE_LABELS[food.source];
}

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

export const DEFAULT_PREFERENCES: Preferences = {
  trackingStyle: 'detailed',
  photoLogging: true,
  textLogging: true,
  aiChat: false,
  recipeIdeas: false,
  aiConsentAt: null,
  diet: 'no_preference',
  avoidIngredients: [],
  cuisines: []
};

export const DEFAULT_SMS: SmsPreferences = {
  enabled: false,
  phone: '',
  consentAt: null
};

export const DEFAULT_CLOUD_SYNC: CloudSyncSettings = {
  enabled: false,
  lastSyncedAt: null
};

export function hasAiAccess(preferences: Preferences): boolean {
  return (
    preferences.aiConsentAt !== null &&
    (preferences.photoLogging ||
      preferences.textLogging ||
      preferences.aiChat ||
      preferences.recipeIdeas)
  );
}
