export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodDTO = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingLabel: string;
  servingGrams?: number;
  nutrients: Nutrients;
  source: 'off' | 'usda';
  createdAt: number;
};

export type KVNamespaceLike = {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};

export type Env = {
  CALAI_CACHE?: KVNamespaceLike;
  USDA_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  ALLOWED_ORIGINS?: string;
  DAILY_SEARCH_LIMIT?: string;
};

export type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export type StoredReminder = {
  id: string;
  meal: Meal;
  time: string;
};

export type PushRecord = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
  timezone: string;
  reminders: StoredReminder[];
  quietStart: string;
  quietEnd: string;
  deviceId: string;
  updatedAt: number;
};
