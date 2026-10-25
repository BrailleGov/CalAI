import type { Meal, Preferences } from '../types';
import { MEAL_LABELS } from '../types';
import { API_BASE, getDeviceToken } from './remote';
import { prepareImage } from './image';

export const AI_CONFIGURED = Boolean(API_BASE);

export class AiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

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

export type AiAnalysis = {
  items: AiFoodItem[];
  note: string;
  uncertain: boolean;
};

export type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiChatReply = {
  reply: string;
  window?: string;
  suggestions: string[];
  proposal?: {
    items: AiFoodItem[];
    meal?: Meal;
    rationale?: string;
  };
};

export type AiRecipeDraft = {
  name: string;
  description: string;
  servings: number;
  timeMinutes: number;
  tags: string[];
  ingredients: AiFoodItem[];
  instructions: string[];
  note: string;
};

export type AiRecipePick = {
  id: string;
  reason: string;
};

export type AiRecipeSuggestion = {
  picks: AiRecipePick[];
  note: string;
};

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

function apiUrl(path: string): string {
  if (!API_BASE) {
    throw new AiError(
      'AI features need the CalAI service. Deploy the Worker and set VITE_API_BASE.',
      503
    );
  }
  return `${API_BASE}${path}`;
}

async function requestJson<T>(
  path: string,
  body: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);

  try {
    const device = getDeviceToken();
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(device ? { 'X-CalAI-Device': device } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : response.status === 429
            ? 'Daily AI limit reached. Try again tomorrow.'
            : 'The assistant is unavailable right now.';
      throw new AiError(message, response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiError('That took too long. Check your connection and try again.');
    }
    throw new AiError('The assistant needs a connection.');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function finite(value: unknown, min: number, max: number, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function sanitizeAiItems(value: unknown, limit = 12): AiFoodItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw): AiFoodItem[] => {
      if (!raw || typeof raw !== 'object') return [];
      const record = raw as Record<string, unknown>;
      const name = text(record.name, 120);
      if (!name) return [];
      const gramsRaw = finite(record.grams, 0, 5000, 0);
      return [
        {
          name,
          grams: gramsRaw > 0 ? round1(gramsRaw) : null,
          quantityLabel: text(record.quantityLabel, 60),
          kcal: Math.round(finite(record.kcal, 0, 5000)),
          protein: round1(finite(record.protein, 0, 1000)),
          carbs: round1(finite(record.carbs, 0, 1000)),
          fat: round1(finite(record.fat, 0, 1000)),
          confidence: finite(record.confidence, 0, 1, 0.4),
          ...(text(record.notes, 200) ? { notes: text(record.notes, 200) } : {})
        }
      ];
    })
    .slice(0, limit);
}

function sanitizeStringList(value: unknown, limit: number, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, max))
    .filter(Boolean)
    .slice(0, limit);
}

export async function analyzeMealPhoto(
  file: File,
  options: RequestOptions & { note?: string } = {}
): Promise<AiAnalysis> {
  if (!AI_CONFIGURED) {
    throw new AiError('Photo recognition needs the CalAI service. Use manual search instead.', 503);
  }
  const image = await prepareImage(file);
  const payload = await requestJson<Record<string, unknown>>(
    '/v1/ai/recognize',
    {
      image: image.dataUrl,
      note: options.note?.slice(0, 300) ?? ''
    },
    { ...options, timeoutMs: 60_000 }
  );

  const items = sanitizeAiItems(payload.items);
  if (items.length === 0) {
    throw new AiError(
      text(payload.error, 300) || 'No food was clear enough to identify. Try another photo.',
      422
    );
  }

  return {
    items,
    note: text(payload.note, 400),
    uncertain:
      payload.uncertain === true ||
      items.some((item) => item.confidence < 0.55) ||
      items.length === 0
  };
}

export async function parseMealText(
  value: string,
  options: RequestOptions = {}
): Promise<AiAnalysis> {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    throw new AiError('Describe what you ate in a few words.', 400);
  }

  const payload = await requestJson<Record<string, unknown>>(
    '/v1/ai/parse',
    { text: trimmed.slice(0, 800) },
    { ...options, timeoutMs: 35_000 }
  );

  const items = sanitizeAiItems(payload.items);
  if (items.length === 0) {
    throw new AiError(
      text(payload.error, 300) || 'No foods were recognised. Try naming the items.',
      422
    );
  }

  return {
    items,
    note: text(payload.note, 400),
    uncertain:
      payload.uncertain === true || items.some((item) => item.confidence < 0.55)
  };
}

export async function askAssistant(
  messages: AiChatMessage[],
  context: unknown,
  options: RequestOptions = {}
): Promise<AiChatReply> {
  const payload = await requestJson<Record<string, unknown>>(
    '/v1/ai/chat',
    {
      messages: messages.slice(-10).map((message) => ({
        role: message.role,
        content: message.content.slice(0, 2000)
      })),
      context
    },
    { ...options, timeoutMs: 45_000 }
  );

  const reply = text(payload.reply, 4000);
  if (!reply) {
    throw new AiError('The assistant returned an empty answer. Try rephrasing.', 502);
  }

  const proposalRaw =
    payload.proposal && typeof payload.proposal === 'object'
      ? (payload.proposal as Record<string, unknown>)
      : null;
  const proposalItems = proposalRaw ? sanitizeAiItems(proposalRaw.items, 10) : [];
  const meal = proposalRaw?.meal;

  return {
    reply,
    ...(text(payload.window, 80) ? { window: text(payload.window, 80) } : {}),
    suggestions: sanitizeStringList(payload.suggestions, 4, 80),
    ...(proposalItems.length > 0
      ? {
          proposal: {
            items: proposalItems,
            ...(meal === 'breakfast' || meal === 'lunch' || meal === 'dinner' || meal === 'snack'
              ? { meal }
              : {}),
            ...(text(proposalRaw?.rationale, 300)
              ? { rationale: text(proposalRaw?.rationale, 300) }
              : {})
          }
        }
      : {})
  };
}

export function recipePreferences(preferences: Preferences): Record<string, unknown> {
  return {
    diet: preferences.diet,
    cuisines: preferences.cuisines,
    avoidIngredients: preferences.avoidIngredients,
    trackingStyle: preferences.trackingStyle
  };
}

export async function generateRecipe(
  input: {
    prompt: string;
    meal?: Meal;
    servings?: number;
    maxMinutes?: number;
    preferences: Preferences;
    trainingFocus?: string[];
  },
  options: RequestOptions = {}
): Promise<AiRecipeDraft> {
  const payload = await requestJson<Record<string, unknown>>(
    '/v1/ai/recipes',
    {
      mode: 'generate',
      prompt: input.prompt.trim().slice(0, 500),
      meal: input.meal,
      servings: input.servings,
      maxMinutes: input.maxMinutes,
      trainingFocus: input.trainingFocus?.slice(0, 4) ?? [],
      preferences: recipePreferences(input.preferences)
    },
    { ...options, timeoutMs: 55_000 }
  );

  const recipe =
    payload.recipe && typeof payload.recipe === 'object'
      ? (payload.recipe as Record<string, unknown>)
      : null;
  if (!recipe) throw new AiError('No recipe came back. Try a simpler request.', 502);

  const ingredients = sanitizeAiItems(recipe.ingredients, 20);
  const instructions = sanitizeStringList(recipe.instructions, 15, 500);
  const name = text(recipe.name, 120);
  if (!name || ingredients.length === 0 || instructions.length === 0) {
    throw new AiError('The recipe was incomplete. Try again.', 502);
  }

  return {
    name,
    description: text(recipe.description, 600),
    servings: finite(recipe.servings, 0.25, 20, 2),
    timeMinutes: Math.round(finite(recipe.timeMinutes, 5, 180, 30)),
    tags: sanitizeStringList(recipe.tags, 8, 30),
    ingredients,
    instructions,
    note: text(payload.note, 400)
  };
}

export async function suggestRecipes(
  candidates: { id: string; name: string; description: string; tags: string[] }[],
  preferences: Preferences,
  options: RequestOptions = {}
): Promise<AiRecipeSuggestion> {
  const payload = await requestJson<Record<string, unknown>>(
    '/v1/ai/recipes',
    {
      mode: 'suggest',
      candidates: candidates.slice(0, 30),
      preferences: recipePreferences(preferences)
    },
    { ...options, timeoutMs: 35_000 }
  );

  const allowed = new Set(candidates.map((item) => item.id));
  const picks = Array.isArray(payload.picks)
    ? payload.picks.flatMap((raw): AiRecipePick[] => {
        if (!raw || typeof raw !== 'object') return [];
        const record = raw as Record<string, unknown>;
        const id = text(record.id, 80);
        if (!allowed.has(id)) return [];
        return [{ id, reason: text(record.reason, 200) }];
      })
    : [];

  return { picks, note: text(payload.note, 300) };
}

export function aiItemMealNote(meal: Meal): string {
  return `Add these estimates to ${MEAL_LABELS[meal].toLowerCase()}?`;
}
