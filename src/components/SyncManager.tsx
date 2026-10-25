import { useEffect, useRef } from 'react';
import { getPersistedData, useAppStore } from '../store/useAppStore';
import { useToast } from './Toast';
import { pushCloudSnapshot, snapshotForCloud } from '../lib/sync';

const DEBOUNCE_MS = 6_000;

function payloadKey() {
  const data = snapshotForCloud(getPersistedData());
  return JSON.stringify({
    ...data,
    cloudSync: { enabled: data.cloudSync.enabled, lastSyncedAt: null }
  });
}

export function SyncManager() {
  const enabled = useAppStore((state) => state.cloudSync.enabled);
  const toast = useToast();
  const failedOnce = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;
    let cancelled = false;
    let lastKey = '';
    let busy = false;

    const flush = async () => {
      if (cancelled || busy) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      const key = payloadKey();
      if (key === lastKey) return;

      busy = true;
      try {
        const updatedAt = await pushCloudSnapshot(getPersistedData());
        if (cancelled) return;
        lastKey = key;
        useAppStore.getState().updateCloudSync({ lastSyncedAt: updatedAt });
        failedOnce.current = false;
      } catch {
        if (!cancelled && !failedOnce.current) {
          failedOnce.current = true;
          toast('Cloud backup failed. Your local diary is safe.');
        }
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), DEBOUNCE_MS);
    };

    const unsubscribe = useAppStore.subscribe(() => {
      schedule();
    });

    const handleOnline = () => schedule();
    window.addEventListener('online', handleOnline);
    schedule();

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, toast]);

  return null;
}
