import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { SCHEMA_VERSION } from '../types';
import type { PersistedData } from '../types';
import { validatePersistedData } from './backup';

export const STATE_KEY = 'calai:v1';

const PROBE_KEY = 'calai:storage-probe';
const LEGACY_MARKER = 'calai:legacy-checked';

export const storageAvailable = (() => {
  try {
    localStorage.setItem(PROBE_KEY, '1');
    const ok = localStorage.getItem(PROBE_KEY) === '1';
    localStorage.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
})();

/**
 * State lives in localStorage because async IndexedDB hydration could hang the whole app
 * when storage is blocked (private windows, strict privacy settings, in-app browsers). The
 * diary is small enough for localStorage; schema v3 keeps this synchronous so no boot gate is
 * reintroduced. Optional encrypted cloud backup is separate and opt-in.
 */
export const stateStorage: PersistStorage<PersistedData> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as unknown;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('state' in parsed)
      ) {
        localStorage.removeItem(name);
        return null;
      }

      const result = validatePersistedData((parsed as { state: unknown }).state);
      if (!result.ok) {
        localStorage.removeItem(name);
        return null;
      }

      return {
        state: result.data,
        version: SCHEMA_VERSION
      } satisfies StorageValue<PersistedData>;
    } catch {
      try {
        localStorage.removeItem(name);
      } catch {
        // Storage is blocked; start from defaults.
      }
      return null;
    }
  },

  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch {
      // Quota or privacy blocking. The app keeps working in memory and the UI warns.
    }
  },

  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing to do if storage is blocked.
    }
  }
};

export function hasLegacyMarker(): boolean {
  try {
    return localStorage.getItem(LEGACY_MARKER) === '1';
  } catch {
    return true;
  }
}

export function markLegacyChecked(): void {
  try {
    localStorage.setItem(LEGACY_MARKER, '1');
  } catch {
    // If localStorage is blocked there is nowhere to remember this; ignore.
  }
}
