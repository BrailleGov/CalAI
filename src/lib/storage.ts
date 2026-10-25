import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { SCHEMA_VERSION } from '../types';
import type { PersistedData } from '../types';
import { validatePersistedData } from './backup';

export const STATE_KEY = 'calai:v1';

const PROBE_KEY = 'calai:storage-probe';
const LEGACY_MARKER = 'calai:legacy-checked';
const QUARANTINE_KEY = 'calai:quarantine';

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

export type StorageStatus = {
  blocked: boolean;
  writeFailed: boolean;
  quarantine: boolean;
};

let status: StorageStatus = {
  blocked: !storageAvailable,
  writeFailed: false,
  quarantine: false
};
const statusListeners = new Set<() => void>();

function publishStatus(patch: Partial<StorageStatus>): void {
  status = { ...status, ...patch };
  for (const listener of statusListeners) listener();
}

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * Keep a bounded copy of an unreadable document so a validation bug or a
 * future schema cannot silently destroy the only diary copy. The normal state
 * key is still removed so the app can start safely.
 */
function quarantine(raw: string | null, reason: string): void {
  if (!raw) {
    publishStatus({ quarantine: true });
    return;
  }
  try {
    localStorage.setItem(
      QUARANTINE_KEY,
      JSON.stringify({
        at: Date.now(),
        reason,
        raw: raw.slice(0, 500_000)
      })
    );
  } catch {
    // Best effort. The original key is still removed below.
  }
  publishStatus({ quarantine: true });
}

/**
 * State lives in localStorage because async IndexedDB hydration could hang the whole app
 * when storage is blocked (private windows, strict privacy settings, in-app browsers). The
 * diary is small enough for localStorage; schema v3 keeps this synchronous so no boot gate is
 * reintroduced. Optional encrypted cloud backup is separate and opt-in.
 */
export const stateStorage: PersistStorage<PersistedData> = {
  getItem: (name) => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(name);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as unknown;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('state' in parsed)
      ) {
        quarantine(raw, 'Persisted state is missing a state field.');
        localStorage.removeItem(name);
        return null;
      }

      const result = validatePersistedData((parsed as { state: unknown }).state);
      if (!result.ok) {
        quarantine(raw, result.error);
        localStorage.removeItem(name);
        return null;
      }

      return {
        state: result.data,
        version: SCHEMA_VERSION
      } satisfies StorageValue<PersistedData>;
    } catch {
      quarantine(raw, 'Persisted state could not be parsed.');
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
      if (status.writeFailed) publishStatus({ writeFailed: false });
    } catch {
      // Quota or privacy blocking. The app keeps working in memory and the UI warns.
      publishStatus({ writeFailed: true });
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
