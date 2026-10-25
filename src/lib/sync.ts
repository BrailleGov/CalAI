import type { PersistedData } from '../types';
import { validatePersistedData } from './backup';
import { API_BASE, getDeviceToken, rotateDeviceToken } from './remote';

const TOKEN_KEY = 'calai:sync-token';
const MAX_SNAPSHOT_BYTES = 700_000;

export const SYNC_CONFIGURED = Boolean(API_BASE);

export class SyncError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

export function getSyncToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function setSyncToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // If storage is blocked, cloud backup cannot be identified across reloads.
  }
}

export function clearSyncToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  if (response.status === 401) return 'This device is not authorised. Reconnect cloud backup.';
  if (response.status === 404) return 'No cloud backup was found for this device.';
  if (response.status === 413) return 'The diary is too large for cloud backup.';
  return 'Cloud backup is unavailable right now.';
}

async function requireToken(): Promise<string> {
  if (!SYNC_CONFIGURED) {
    throw new SyncError(
      'Cloud backup needs the CalAI service. Deploy the Worker and set VITE_API_BASE.',
      503
    );
  }
  const existing = getSyncToken();
  if (existing) return existing;
  return registerDevice();
}

export async function registerDevice(): Promise<string> {
  if (!SYNC_CONFIGURED) {
    throw new SyncError('Cloud backup is not configured in this build.', 503);
  }
  if (!getDeviceToken()) {
    throw new SyncError('This browser is blocking local storage, so cloud backup cannot be linked.');
  }

  async function attempt(): Promise<Response | null> {
    const device = getDeviceToken();
    return fetch(`${API_BASE}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CalAI-Device': device },
      body: '{}'
    }).catch(() => null);
  }

  let response = await attempt();
  if (response?.status === 409) {
    rotateDeviceToken();
    response = await attempt();
  }

  if (!response) throw new SyncError('Cloud backup needs a connection.');
  if (!response.ok) throw new SyncError(await readError(response), response.status);

  const payload = (await response.json().catch(() => null)) as unknown;
  const token =
    payload && typeof payload === 'object'
      ? (payload as { token?: unknown }).token
      : undefined;
  if (typeof token !== 'string' || token.length < 20) {
    throw new SyncError('The service did not return a valid device key.');
  }

  setSyncToken(token);
  return token;
}

export function snapshotForCloud(data: PersistedData): PersistedData {
  return {
    ...data,
    sms: {
      enabled: false,
      phone: '',
      consentAt: null
    }
  };
}

export async function pushCloudSnapshot(data: PersistedData): Promise<number> {
  const token = await requireToken();
  const device = getDeviceToken();
  const snapshot = snapshotForCloud(data);
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > MAX_SNAPSHOT_BYTES) {
    throw new SyncError('The diary is too large to back up to the cloud. Export a file instead.');
  }

  const response = await fetch(`${API_BASE}/v1/sync`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CalAI-Device': device,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ data: snapshot })
  }).catch(() => null);

  if (!response) throw new SyncError('Cloud backup needs a connection.');
  if (!response.ok) throw new SyncError(await readError(response), response.status);
  const payload = (await response.json().catch(() => null)) as unknown;
  return payload && typeof payload === 'object' && typeof (payload as { updatedAt?: unknown }).updatedAt === 'number'
    ? (payload as { updatedAt: number }).updatedAt
    : Date.now();
}

export async function pullCloudSnapshot(): Promise<PersistedData> {
  const token = await requireToken();
  const device = getDeviceToken();
  const response = await fetch(`${API_BASE}/v1/sync`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-CalAI-Device': device,
      Authorization: `Bearer ${token}`
    }
  }).catch(() => null);

  if (!response) throw new SyncError('Cloud backup needs a connection.');
  if (!response.ok) throw new SyncError(await readError(response), response.status);

  const payload = (await response.json().catch(() => null)) as unknown;
  const data =
    payload && typeof payload === 'object'
      ? (payload as { data?: unknown }).data
      : undefined;
  const result = validatePersistedData(data);
  if (!result.ok) {
    throw new SyncError('The cloud backup could not be read.');
  }
  return result.data;
}

export async function deleteCloudSnapshot(): Promise<void> {
  const token = getSyncToken();
  if (!token || !SYNC_CONFIGURED) return;
  const device = getDeviceToken();
  const response = await fetch(`${API_BASE}/v1/sync`, {
    method: 'DELETE',
    headers: {
      'X-CalAI-Device': device,
      Authorization: `Bearer ${token}`
    }
  }).catch(() => null);

  if (!response) throw new SyncError('Cloud backup needs a connection.');
  if (!response.ok && response.status !== 404) {
    throw new SyncError(await readError(response), response.status);
  }
  clearSyncToken();
}
