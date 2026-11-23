// Service Worker for Offline PWA & Push Notifications - سجل المتبرعين بالدم (قعطبة)
const CACHE_NAME = 'qaatabah-blood-registry-v4';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to pre-cache some assets during install:', err);
      });
    })
  );
  // Activate immediately on initial install; when upgrading an existing worker,
  // allow the app UI to prompt the user ("تحديث الآن") and send SKIP_WAITING.
  if (!self.registration || !self.registration.active) {
    self.skipWaiting();
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// -------------------------------------------------------------
// PUSH NOTIFICATIONS EVENT LISTENER (تلقي الإشعارات الفورية الخارجية)
// -------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: '🚨 نداء دم عاجل - مديرية قعطبة',
        body: event.data.text()
      };
    }
  }

  const notification = data.notification || {};
  const dataPayload = data.data || {};

  const title = notification.title || data.title || dataPayload.title || '🚨 نداء دم عاجل في قعطبة';
  const body = notification.body || data.body || dataPayload.body || 'يوجد نداء دم عاجل في مديرية قعطبة. اضغط هنا للاستجابة فوراً.';
  const requestId = dataPayload.requestId || data.requestId || '';
  const bloodType = dataPayload.bloodType || data.bloodType || '';
  const district = dataPayload.district || data.district || 'مديرية قعطبة';
  const targetUrl = dataPayload.url || data.url || (requestId ? `/?openRequest=${requestId}` : '/');

  const options = {
    body,
    icon: notification.icon || data.icon || '/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg',
    badge: notification.badge || data.badge || '/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg',
    vibrate: [350, 100, 350, 100, 350],
    tag: data.tag || (requestId ? `blood-req-${requestId}` : 'blood-emergency-alert'),
    renotify: true,
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar',
    data: {
      requestId,
      bloodType,
      district,
      url: targetUrl
    },
    actions: [
      { action: 'open_request', title: '🩸 عرض التفاصيل والاستجابة' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// -------------------------------------------------------------
// NOTIFICATION CLICK EVENT LISTENER (الضغط على الإشعار وفتح الطلب)
// -------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notifData = event.notification.data || {};
  const requestId = notifData.requestId || '';
  const targetUrl = notifData.url || (requestId ? `/?openRequest=${requestId}` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an app window is already open, focus it and post message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'OPEN_REQUEST_NOTIFICATION',
            requestId: requestId,
            url: targetUrl
          });
          // Also navigate if not on home
          if (requestId && 'navigate' in client && !client.url.includes(requestId)) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }

      // 2. If no window is currently open, open a new window directly with the request parameter
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// -------------------------------------------------------------
// FETCH & OFFLINE CACHE EVENT LISTENER
// -------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never intercept or cache Firestore, Firebase Auth, or backend API requests
  const reqUrl = request.url;
  if (
    reqUrl.includes('firestore.googleapis.com') ||
    reqUrl.includes('identitytoolkit.googleapis.com') ||
    reqUrl.includes('securetoken.googleapis.com') ||
    reqUrl.includes('/api/')
  ) {
    return;
  }

  // Handle SPA navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('./index.html') || await cache.match('/');
        return cachedIndex || new Response('Offline', { status: 200, headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Cache-first or Stale-while-revalidate for assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch updated version in background to refresh cache
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const url = request.url;
        if (
          url.includes('/assets/') ||
          url.includes('fonts.googleapis.com') ||
          url.includes('fonts.gstatic.com') ||
          url.endsWith('.webmanifest') ||
          url.endsWith('.svg') ||
          url.endsWith('.png') ||
          url.endsWith('.jpg')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        if (request.destination === 'image') {
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#be123c"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Offline resource not cached', { status: 503 });
      });
    })
  );
});
