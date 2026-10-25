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

export type D1ResultLike<T> = {
  results?: T[];
  success?: boolean;
};

export type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
};

export type Env = {
  CALAI_CACHE?: KVNamespaceLike;
  DB?: D1DatabaseLike;
  USDA_API_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  ALLOWED_ORIGINS?: string;
  DAILY_SEARCH_LIMIT?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
  AI_DAILY_RECOGNIZE?: string;
  AI_DAILY_PARSE?: string;
  AI_DAILY_CHAT?: string;
  AI_DAILY_RECIPE?: string;
  AI_MONTHLY_REQUEST_CAP?: string;
  TEXTBELT_API_KEY?: string;
  TEXTBELT_BASE_URL?: string;
  DATA_ENC_KEY?: string;
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

export type AiFoodItem = {
  name: string;
  grams: number | null;
  quantityLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  notes?: string;
};

export type SmsRow = {
  device_id: string;
  phone_cipher: string;
  phone_iv: string;
  enabled: number;
  consent_at: number | null;
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  reminders_json: string;
  updated_at: number;
};

export type DeviceRow = {
  id: string;
  secret_hash: string;
  created_at: number;
  last_seen_at: number;
};

export type SyncRow = {
  device_id: string;
  ciphertext: string;
  iv: string;
  updated_at: number;
};
