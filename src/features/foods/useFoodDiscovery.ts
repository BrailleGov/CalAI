import { useCallback, useEffect, useRef, useState } from 'react';
import type { Food } from '../../types';
import { AI_CONFIGURED } from '../../lib/ai';
import {
  API_BASE,
  discoverSharedFoods,
  searchSharedFoods
} from '../../lib/remote';
import { useAppStore } from '../../store/useAppStore';

export type FoodDiscoveryStatus = 'idle' | 'searching' | 'finding' | 'done' | 'error';

export function useFoodDiscovery(query: string, enabled: boolean) {
  const aiConsent = useAppStore((state) => state.preferences.aiConsentAt !== null);

  const [foods, setFoods] = useState<Food[]>([]);
  const [status, setStatus] = useState<FoodDiscoveryStatus>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const session = useRef<Map<string, Food[]>>(new Map());

  const trimmed = query.trim();

  useEffect(() => {
    if (!enabled || trimmed.length < 2 || !API_BASE) {
      setFoods([]);
      setStatus('idle');
      setNote('');
      setError('');
      return;
    }

    const cacheKey = `${trimmed}|${aiConsent ? 'ai' : 'shared'}`;
    const cached = session.current.get(cacheKey);
    if (cached) {
      setFoods(cached);
      setStatus('done');
      setNote('');
      setError('');
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    let sharedDone = false;
    let aiDone = !(AI_CONFIGURED && aiConsent);
    let anySuccess = false;
    let lastError = 'Food discovery is unavailable right now.';

    setFoods([]);
    setStatus('searching');
    setNote('');
    setError('');

    const merge = (incoming: Food[]) => {
      if (incoming.length === 0 || signal.aborted) return;
      anySuccess = true;
      setFoods((current) => {
        const seen = new Set(current.map((food) => food.id));
        const next = [...current];
        for (const food of incoming) {
          if (!seen.has(food.id)) {
            seen.add(food.id);
            next.push(food);
          }
        }
        session.current.set(cacheKey, next);
        return next;
      });
    };

    const refreshStatus = () => {
      if (signal.aborted) return;
      if (!sharedDone) {
        setStatus('searching');
        return;
      }
      if (!aiDone) {
        setStatus('finding');
        return;
      }
      if (anySuccess) {
        setStatus('done');
      } else {
        setStatus('error');
        setError(lastError);
      }
    };

    const timer = window.setTimeout(() => {
      void searchSharedFoods(trimmed, signal)
        .then((response) => {
          merge(response.foods);
          if (response.note) setNote(response.note);
        })
        .catch((errorValue: unknown) => {
          if (errorValue instanceof Error) lastError = errorValue.message;
        })
        .finally(() => {
          sharedDone = true;
          refreshStatus();
        });

      if (AI_CONFIGURED && aiConsent) {
        void discoverSharedFoods(trimmed, signal)
          .then((response) => {
            merge(response.foods);
            if (response.note) setNote(response.note);
          })
          .catch((errorValue: unknown) => {
            if (errorValue instanceof Error) lastError = errorValue.message;
          })
          .finally(() => {
            aiDone = true;
            refreshStatus();
          });
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [aiConsent, attempt, enabled, trimmed]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    foods,
    status,
    note,
    error,
    aiConsent,
    aiConfigured: AI_CONFIGURED,
    retry
  };
}
