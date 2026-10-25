/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision?: string | null })[];
};

type PushPayload = {
  title?: string;
  body?: string;
  meal?: string;
  url?: string;
};

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL('/CalAI/index.html')));

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination === 'image' &&
    url.pathname.startsWith('/CalAI/'),
  new CacheFirst({ cacheName: 'calai-images', matchOptions: { ignoreSearch: true } })
);

self.addEventListener('push', (event) => {
  let payload: PushPayload = {
    title: 'CalAI',
    body: 'Time to log a meal',
    meal: 'lunch',
    url: '/CalAI/#/today'
  };

  try {
    const incoming = event.data?.json() as PushPayload | undefined;
    if (incoming) payload = { ...payload, ...incoming };
  } catch {
    // Keep the generic meal reminder when a payload is malformed.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'CalAI', {
      body: payload.body ?? 'Time to log a meal',
      icon: '/CalAI/icons/icon-192.png',
      badge: '/CalAI/icons/icon-192.png',
      tag: `calai-meal-${payload.meal ?? 'meal'}`,
      data: { url: payload.url ?? '/CalAI/#/today' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? '/CalAI/#/today',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === target && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
