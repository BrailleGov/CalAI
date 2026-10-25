import type { ReminderSettings } from '../types';
import { API_BASE, getDeviceToken } from './remote';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

export const pushConfigured = Boolean(API_BASE && VAPID_PUBLIC_KEY);

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

async function postSubscription(
  subscription: PushSubscription,
  reminders: ReminderSettings
): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CalAI-Device': getDeviceToken()
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      quietStart: reminders.quietStart,
      quietEnd: reminders.quietEnd,
      reminders: (reminders.enabled
        ? reminders.items.filter((reminder) => reminder.enabled)
        : []
      ).map((reminder) => ({
        id: reminder.id,
        meal: reminder.meal,
        time: reminder.time
      }))
    })
  });

  if (!response.ok) {
    throw new Error('The reminder service could not save this device.');
  }
}

export async function subscribeToPush(reminders: ReminderSettings): Promise<void> {
  if (!pushConfigured) {
    throw new Error('Push reminders are not configured in this build.');
  }
  if (!pushSupported()) {
    throw new Error('This browser does not support push notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }));

  await postSubscription(subscription, reminders);
}

export async function syncPushReminders(reminders: ReminderSettings): Promise<void> {
  if (!pushConfigured || !pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await postSubscription(subscription, reminders);
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/v1/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CalAI-Device': getDeviceToken()
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
    } catch {
      // Best effort: still remove the local subscription.
    }
  }

  await subscription.unsubscribe();
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!pushConfigured || !pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return Boolean(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
