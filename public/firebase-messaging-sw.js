// Firebase Cloud Messaging Service Worker - سجل المتبرعين بالدم (قعطبة)
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    projectId: "avian-gate-pbcxw",
    appId: "1:589909705354:web:3d9e372d5712e34ed0e373",
    apiKey: "AIzaSyCLtHs6SO9brCt3hMpq5di6XQdeO02i4rQ",
    authDomain: "avian-gate-pbcxw.firebaseapp.com",
    messagingSenderId: "589909705354",
    storageBucket: "avian-gate-pbcxw.firebasestorage.app"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || payload.data?.title || '🚨 نداء دم عاجل - مديرية قعطبة';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'يوجد طلب دم عاجل في مديرية قعطبة. اضغط للاستجابة فوراً.',
      icon: '/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg',
      badge: '/assets/aistudio/1001974620_imgupscaler.ai__________2K_b80bcc57.jpg',
      tag: payload.data?.requestId ? `blood-req-${payload.data.requestId}` : 'blood-emergency-alert',
      vibrate: [350, 100, 350, 100, 350],
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: true,
      data: {
        requestId: payload.data?.requestId,
        bloodType: payload.data?.bloodType,
        district: payload.data?.district,
        url: payload.data?.requestId ? `/?openRequest=${payload.data.requestId}` : '/'
      },
      actions: [
        { action: 'open_request', title: '🩸 عرض التفاصيل والاستجابة' },
        { action: 'close', title: 'إغلاق' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.debug('Firebase messaging service worker init note:', e);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const notifData = event.notification.data || {};
  const requestId = notifData.requestId || '';
  const targetUrl = notifData.url || (requestId ? `/?openRequest=${requestId}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'OPEN_REQUEST_NOTIFICATION',
            requestId: requestId,
            url: targetUrl
          });
          if (requestId && 'navigate' in client && !client.url.includes(requestId)) {
            client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
