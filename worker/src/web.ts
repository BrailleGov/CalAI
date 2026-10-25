import { readCache, writeCache } from './cache';
import { consumeQuota, dayKey, monthKey } from './quota';
import type { Env } from './types';

export type WebResult = {
  title: string;
  url: string;
  domain: string;
  description: string;
  age?: string;
};

export type WebSource = {
  title: string;
  url: string;
  domain: string;
};

export type WebSearchResult = {
  query: string;
  results: WebResult[];
  cached: boolean;
};

const DEFAULT_BASE = 'https://api.search.brave.com';
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_QUERY_CHARS = 200;
const MAX_RESULTS = 6;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x27|39);/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
    .slice(0, max);
}

function safeUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function identity(request: Request): string {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const device = (request.headers.get('X-CalAI-Device') ?? '').slice(0, 80);
  return device ? `${device}:${ip}` : ip;
}

function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_CHARS);
}

function cacheKey(query: string): string {
  return `web:${query.toLowerCase()}`;
}

function emptyResult(query: string): WebSearchResult {
  return { query, results: [], cached: false };
}

export function toWebSources(results: WebResult[], max = 4): WebSource[] {
  return results.slice(0, max).map(({ title, url, domain }) => ({ title, url, domain }));
}

export function webEvidenceText(results: WebResult[]): string {
  return results
    .slice(0, MAX_RESULTS)
    .map(
      (result, index) =>
        `${index + 1}. ${result.title} (${result.domain}${result.age ? `, ${result.age}` : ''}): ${result.description}`
    )
    .join('\n')
    .slice(0, 3_500);
}

export async function searchWeb(
  env: Env,
  request: Request | undefined,
  query: string,
  options: { count?: number; timeoutMs?: number } = {}
): Promise<WebSearchResult> {
  const normalized = normalizeQuery(query);
  if (!env.BRAVE_SEARCH_API_KEY || normalized.length < 2) return emptyResult(normalized);

  const key = cacheKey(normalized);
  const cached = await readCache<WebResult[]>(env, key);
  if (Array.isArray(cached)) {
    return {
      query: normalized,
      results: cached.slice(0, MAX_RESULTS),
      cached: true
    };
  }

  if (request) {
    const dailyLimit = readLimit(env.WEB_DAILY_SEARCHES, 30);
    const monthlyLimit = readLimit(env.WEB_MONTHLY_SEARCHES, 1_000);
    if (dailyLimit <= 0 || monthlyLimit <= 0) return emptyResult(normalized);

    const dailyOk = await consumeQuota(
      env,
      `web:day:${dayKey()}:${identity(request)}`,
      dailyLimit
    );
    if (!dailyOk) return emptyResult(normalized);

    const monthlyOk = await consumeQuota(
      env,
      `web:month:${monthKey()}`,
      monthlyLimit
    );
    if (!monthlyOk) return emptyResult(normalized);
  }

  const base = (env.BRAVE_SEARCH_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const url = new URL(`${base}/res/v1/web/search`);
  const count = Math.min(MAX_RESULTS, Math.max(1, options.count ?? 4));
  url.searchParams.set('q', normalized);
  url.searchParams.set('count', String(count));
  url.searchParams.set('safesearch', 'moderate');

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(1_000, Math.min(12_000, options.timeoutMs ?? 8_000))
  );

  try {
    const requestInit: RequestInit = {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY
      },
      signal: controller.signal
    };
    let response = await fetch(url.toString(), requestInit);

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfter)
        ? Math.min(1_500, Math.max(250, retryAfter * 1_000))
        : 400;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      response = await fetch(url.toString(), requestInit);
    }

    if (!response.ok) return emptyResult(normalized);

    const payload = (await response.json().catch(() => null)) as
      | { web?: { results?: unknown } }
      | null;
    const rawResults = payload?.web?.results;
    if (!Array.isArray(rawResults)) return emptyResult(normalized);

    const seen = new Set<string>();
    const results: WebResult[] = [];
    for (const raw of rawResults.slice(0, MAX_RESULTS * 2)) {
      if (!raw || typeof raw !== 'object') continue;
      const record = raw as Record<string, unknown>;
      const parsed = safeUrl(record.url);
      const title = cleanText(record.title, 180);
      if (!parsed || !title || seen.has(parsed.href)) continue;

      const description = cleanText(record.description, 500);
      if (!description) continue;

      const age = cleanText(record.page_age ?? record.age, 40);
      seen.add(parsed.href);
      results.push({
        title,
        url: parsed.href,
        domain: parsed.hostname.replace(/^www\./, ''),
        description,
        ...(age ? { age } : {})
      });
      if (results.length >= count) break;
    }

    if (results.length > 0) {
      await writeCache(env, key, results, CACHE_TTL_SECONDS);
    }
    return { query: normalized, results, cached: false };
  } catch {
    return emptyResult(normalized);
  } finally {
    clearTimeout(timer);
  }
}
