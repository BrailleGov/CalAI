import { get } from 'idb-keyval';
import type { PersistedData } from '../types';
import { validatePersistedData } from './backup';
import { STATE_KEY, hasLegacyMarker, markLegacyChecked } from './storage';

const LEGACY_TIMEOUT_MS = 1200;

/**
 * v0.1.0 briefly stored state in IndexedDB. Read it once so an early adopter does not lose
 * a diary after the move to localStorage. Zustand's persisted envelope is `{ state, version }`,
 * but a bare state object is accepted too.
 */
export function parseLegacyState(raw: string | null | undefined): PersistedData | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate =
      'state' in parsed ? (parsed as { state: unknown }).state : parsed;
    const result = validatePersistedData(candidate);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

export function needsLegacyCheck(): boolean {
  try {
    return !localStorage.getItem(STATE_KEY) && !hasLegacyMarker();
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Legacy storage read timed out'));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function readLegacyState(): Promise<PersistedData | null> {
  if (!needsLegacyCheck()) return null;

  if (typeof indexedDB === 'undefined') {
    markLegacyChecked();
    return null;
  }

  try {
    const raw = await withTimeout(get<string>(STATE_KEY), LEGACY_TIMEOUT_MS);
    const data = parseLegacyState(raw);
    markLegacyChecked();
    return data;
  } catch {
    markLegacyChecked();
    return null;
  }
}
