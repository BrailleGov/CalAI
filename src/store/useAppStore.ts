import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_REMINDER_SETTINGS,
  SCHEMA_VERSION
} from '../types';
import type {
  Entry,
  Food,
  Meal,
  Nutrients,
  PersistedData,
  Profile,
  Recipe,
  ReminderSettings,
  Settings,
  Targets
} from '../types';
import { createId } from '../lib/id';
import { STATE_KEY, stateStorage } from '../lib/storage';

const INITIAL_DATA: PersistedData = {
  schemaVersion: SCHEMA_VERSION,
  onboarded: false,
  profile: null,
  targets: { kcal: 2000, protein: 120, carbs: 220, fat: 67 },
  customFoods: [],
  remoteFoods: [],
  entries: [],
  favorites: [],
  recentFoodIds: [],
  recipes: [],
  weights: [],
  water: [],
  reminders: {
    ...DEFAULT_REMINDER_SETTINGS,
    items: DEFAULT_REMINDER_SETTINGS.items.map((item) => ({ ...item }))
  },
  settings: { theme: 'system', units: 'metric', waterGoalMl: 2000 }
};

type LogFoodInput = {
  food: Food;
  meal: Meal;
  date: string;
  quantity: number;
};

type QuickAddInput = {
  name?: string;
  meal: Meal;
  date: string;
  nutrients: Nutrients;
};

type Actions = {
  completeOnboarding: (profile: Profile, targets: Targets) => void;
  updateTargets: (targets: Targets) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addCustomFood: (food: Food) => void;
  updateCustomFood: (food: Food) => void;
  deleteCustomFood: (id: string) => void;
  cacheRemoteFood: (food: Food) => void;
  logFood: (input: LogFoodInput) => void;
  quickAdd: (input: QuickAddInput) => void;
  updateEntryQuantity: (id: string, quantity: number) => void;
  deleteEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  logWeight: (date: string, kg: number) => void;
  deleteWeight: (id: string) => void;
  addWater: (date: string, ml: number) => void;
  deleteWater: (id: string) => void;
  updateReminders: (patch: Partial<ReminderSettings>) => void;
  importData: (data: PersistedData) => void;
  resetData: () => void;
};

export type AppStore = PersistedData & Actions;

function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  void navigator.storage.persist().catch(() => undefined);
}

const RECENT_LIMIT = 10;
const REMOTE_CACHE_LIMIT = 100;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...INITIAL_DATA,

      completeOnboarding: (profile, targets) =>
        set({ profile, targets, onboarded: true }),

      updateTargets: (targets) => set({ targets }),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      addCustomFood: (food) =>
        set((state) => ({ customFoods: [...state.customFoods, food] })),

      updateCustomFood: (food) =>
        set((state) => ({
          customFoods: state.customFoods.map((item) => (item.id === food.id ? food : item))
        })),

      deleteCustomFood: (id) =>
        set((state) => ({
          customFoods: state.customFoods.filter((food) => food.id !== id),
          favorites: state.favorites.filter((foodId) => foodId !== id),
          recentFoodIds: state.recentFoodIds.filter((foodId) => foodId !== id)
        })),

      cacheRemoteFood: (food) =>
        set((state) => ({
          remoteFoods: [
            food,
            ...state.remoteFoods.filter((item) => item.id !== food.id)
          ].slice(0, REMOTE_CACHE_LIMIT)
        })),

      logFood: ({ food, meal, date, quantity }) => {
        const entry: Entry = {
          id: createId(),
          date,
          meal,
          foodId: food.id,
          name: food.name,
          servingLabel: food.servingLabel,
          quantity,
          nutrients: { ...food.nutrients },
          createdAt: Date.now()
        };

        set((state) => ({
          entries: [...state.entries, entry],
          recentFoodIds: [
            food.id,
            ...state.recentFoodIds.filter((id) => id !== food.id)
          ].slice(0, RECENT_LIMIT),
          remoteFoods:
            food.source === 'off' || food.source === 'usda'
              ? [
                  food,
                  ...state.remoteFoods.filter((item) => item.id !== food.id)
                ].slice(0, REMOTE_CACHE_LIMIT)
              : state.remoteFoods
        }));

        requestPersistentStorage();
      },

      quickAdd: ({ name, meal, date, nutrients }) => {
        const entry: Entry = {
          id: createId(),
          date,
          meal,
          name: name?.trim() || 'Quick add',
          servingLabel: 'quick add',
          quantity: 1,
          nutrients,
          createdAt: Date.now()
        };

        set((state) => ({ entries: [...state.entries, entry] }));
        requestPersistentStorage();
      },

      updateEntryQuantity: (id, quantity) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, quantity } : entry
          )
        })),

      deleteEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),

      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((foodId) => foodId !== id)
            : [...state.favorites, id]
        })),

      addRecipe: (recipe) =>
        set((state) => ({ recipes: [...state.recipes, recipe] })),

      updateRecipe: (recipe) =>
        set((state) => ({
          recipes: state.recipes.map((item) => (item.id === recipe.id ? recipe : item))
        })),

      deleteRecipe: (id) => {
        const foodId = `recipe-${id}`;
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
          favorites: state.favorites.filter((item) => item !== foodId),
          recentFoodIds: state.recentFoodIds.filter((item) => item !== foodId)
        }));
      },

      logWeight: (date, kg) =>
        set((state) => {
          const existing = state.weights.find((item) => item.date === date);
          if (existing) {
            return {
              weights: state.weights.map((item) =>
                item.date === date ? { ...item, kg, createdAt: Date.now() } : item
              )
            };
          }

          return {
            weights: [
              ...state.weights,
              { id: createId(), date, kg, createdAt: Date.now() }
            ]
          };
        }),

      deleteWeight: (id) =>
        set((state) => ({ weights: state.weights.filter((item) => item.id !== id) })),

      addWater: (date, ml) => {
        set((state) => ({
          water: [
            ...state.water,
            { id: createId(), date, ml, createdAt: Date.now() }
          ]
        }));
        requestPersistentStorage();
      },

      deleteWater: (id) =>
        set((state) => ({ water: state.water.filter((item) => item.id !== id) })),

      updateReminders: (patch) =>
        set((state) => ({ reminders: { ...state.reminders, ...patch } })),

      importData: (data) => set({ ...data }),

      resetData: () => set({ ...INITIAL_DATA })
    }),
    {
      name: STATE_KEY,
      storage: stateStorage,
      version: SCHEMA_VERSION,
      partialize: (state): PersistedData => ({
        schemaVersion: state.schemaVersion,
        onboarded: state.onboarded,
        profile: state.profile,
        targets: state.targets,
        customFoods: state.customFoods,
        remoteFoods: state.remoteFoods,
        entries: state.entries,
        favorites: state.favorites,
        recentFoodIds: state.recentFoodIds,
        recipes: state.recipes,
        weights: state.weights,
        water: state.water,
        reminders: state.reminders,
        settings: state.settings
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<PersistedData>)
      })
    }
  )
);

export function resetPersistedState() {
  useAppStore.getState().resetData();
}
