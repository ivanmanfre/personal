/* Ivan System Service Worker
 * Handles: precaching (workbox), Supabase REST network-first cache,
 * web push display, notification click → deeplink.
 *
 * Built via vite-plugin-pwa with strategies: 'injectManifest'.
 * Injection point: self.__WB_MANIFEST below.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Supabase REST + RPC routes — network-first so push notifications never
// surface stale state. Cache only as offline fallback.
registerRoute(
  ({ url }) => url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/rest/'),
  new NetworkFirst({
    cacheName: 'supabase-rest-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          return response && response.status === 200 ? response : null;
        },
      },
    ],
  })
);

// ============== PUSH NOTIFICATION HANDLER ==============
// Payload from send-push-notification edge fn:
//   { title, body, severity: 'bad'|'warn'|'good', deeplink: '/dashboard-v2?section=...' }
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ivan System', body: event.data.text() };
  }

  const tag = payload.deeplink || 'ivan-system';
  const options = {
    body: payload.body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag,
    renotify: false,
    requireInteraction: payload.severity === 'bad',
    data: { deeplink: payload.deeplink || '/dashboard-v2' },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.deeplink) || '/dashboard-v2';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes('/dashboard') && 'focus' in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
