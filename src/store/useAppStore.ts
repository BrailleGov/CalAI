import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Entry,
  Food,
  Meal,
  Nutrients,
  PersistedData,
  Profile,
  Settings,
  Targets
} from '../types';
import { createId } from '../lib/id';
import { STATE_KEY, stateStorage } from '../lib/storage';

const INITIAL_DATA: PersistedData = {
  schemaVersion: 1,
  onboarded: false,
  profile: null,
  targets: { kcal: 2000, protein: 120, carbs: 220, fat: 67 },
  customFoods: [],
  entries: [],
  favorites: [],
  recentFoodIds: [],
  settings: { theme: 'system', units: 'metric' }
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
  logFood: (input: LogFoodInput) => void;
  quickAdd: (input: QuickAddInput) => void;
  updateEntryQuantity: (id: string, quantity: number) => void;
  deleteEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  importData: (data: PersistedData) => void;
  resetData: () => void;
};

export type AppStore = PersistedData & Actions;

function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  void navigator.storage.persist().catch(() => undefined);
}

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
          ].slice(0, 10)
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

      importData: (data) => set({ ...data }),

      resetData: () => set({ ...INITIAL_DATA })
    }),
    {
      name: STATE_KEY,
      storage: stateStorage,
      version: 1,
      partialize: (state): PersistedData => ({
        schemaVersion: state.schemaVersion,
        onboarded: state.onboarded,
        profile: state.profile,
        targets: state.targets,
        customFoods: state.customFoods,
        entries: state.entries,
        favorites: state.favorites,
        recentFoodIds: state.recentFoodIds,
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
