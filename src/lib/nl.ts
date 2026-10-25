import type { Food } from '../types';
import { normalizeText } from './search';

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

const FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3
};

const STOP_WORDS = new Set([
  'with',
  'and',
  'plus',
  'some',
  'of',
  'a',
  'an',
  'the',
  'my',
  'for',
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'had',
  'ate',
  'i',
  'we'
]);

export type LocalParseItem = {
  food: Food;
  quantity: number;
  spokenName: string;
  confidence: number;
};

export type LocalParseResult = {
  items: LocalParseItem[];
  unmatched: string[];
};

function leadingQuantity(segment: string): {
  quantity: number;
  grams?: number;
  rest: string;
} {
  const trimmed = segment.trim();
  const gramsMatch = /^(\d+)\s*g(?:rams?)?\s+/i.exec(trimmed);
  if (gramsMatch?.[1]) {
    const grams = Number(gramsMatch[1]);
    if (Number.isFinite(grams) && grams > 0) {
      return {
        quantity: 1,
        grams: Math.min(5000, grams),
        rest: trimmed.slice(gramsMatch[0].length).trim()
      };
    }
  }

  const fractionMatch = /^(\d+)\s*\/\s*(\d+)\b/.exec(trimmed);
  if (fractionMatch?.[1] && fractionMatch[2]) {
    const value = Number(fractionMatch[1]) / Number(fractionMatch[2]);
    if (Number.isFinite(value) && value > 0) {
      return { quantity: value, rest: trimmed.slice(fractionMatch[0].length).trim() };
    }
  }

  const symbolMatch = /^([½¼¾⅓⅔])\s*/.exec(trimmed);
  if (symbolMatch?.[1]) {
    return {
      quantity: FRACTIONS[symbolMatch[1]] ?? 1,
      rest: trimmed.slice(symbolMatch[0].length).trim()
    };
  }

  const numberMatch = /^(\d+(?:\.\d+)?)\s*(?:x|×)?\s*/.exec(trimmed);
  if (numberMatch?.[1]) {
    const value = Number(numberMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return { quantity: Math.min(20, value), rest: trimmed.slice(numberMatch[0].length).trim() };
    }
  }

  const wordMatch = /^([a-z]+)\s+/i.exec(trimmed);
  if (wordMatch?.[1]) {
    const value = WORD_NUMBERS[wordMatch[1].toLowerCase()];
    if (value) {
      return { quantity: value, rest: trimmed.slice(wordMatch[0].length).trim() };
    }
  }

  return { quantity: 1, rest: trimmed };
}

function tokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function matchScore(food: Food, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = tokens(`${food.name} ${food.brand ?? ''}`);
  const haystackSet = new Set(haystack);
  let hits = 0;
  for (const token of queryTokens) {
    if (haystackSet.has(token)) {
      hits += 1;
      continue;
    }
    if (haystack.some((word) => word.startsWith(token) || token.startsWith(word))) {
      hits += 0.6;
    }
  }
  return hits / queryTokens.length;
}

export function splitMealText(text: string): string[] {
  return text
    .split(/\n|,|;|\+| and | & /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Conservative offline parser for simple phrases such as "2 eggs and toast".
 * It only returns foods that exist in the supplied library; it never invents nutrition.
 */
export function parseFoodTextLocally(text: string, foods: Food[]): LocalParseResult {
  const segments = splitMealText(text).slice(0, 8);
  const items: LocalParseItem[] = [];
  const unmatched: string[] = [];
  const used = new Set<string>();

  for (const segment of segments) {
    const { quantity, grams, rest } = leadingQuantity(segment);
    const cleaned = rest || segment;
    const queryTokens = tokens(cleaned);

    let best: Food | null = null;
    let bestScore = 0;
    for (const food of foods) {
      if (used.has(food.id)) continue;
      const score = matchScore(food, queryTokens);
      if (score > bestScore) {
        best = food;
        bestScore = score;
      }
    }

    if (best && bestScore >= 0.5) {
      used.add(best.id);
      const resolvedQuantity =
        grams !== undefined && best.servingGrams
          ? grams / best.servingGrams
          : quantity;
      items.push({
        food: best,
        quantity: Math.max(0.25, Math.min(20, resolvedQuantity)),
        spokenName: cleaned,
        confidence: Math.min(0.85, 0.55 + bestScore * 0.3)
      });
    } else {
      unmatched.push(cleaned);
    }
  }

  return { items, unmatched };
}
