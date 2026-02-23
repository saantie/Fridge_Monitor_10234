// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqQcDngmgSj1KbZQQ9j9pZiMmPs7ydue0",
  authDomain: "notify-fridge-monitor-pwa.firebaseapp.com",
  projectId: "notify-fridge-monitor-pwa",
  storageBucket: "notify-fridge-monitor-pwa",
  messagingSenderId: "623427160222",
  appId: "1:623427160222:web:780e2011212969f6b5d38f"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification.title || 'Fridge Monitor Alert';
  const notificationOptions = {
    body: payload.notification.body || 'Temperature alert',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'temperature-alert',
    requireInteraction: payload.data?.severity === 'critical',
    vibrate: payload.data?.severity === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      url: self.location.origin + '/',
      ...payload.data
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});

console.log('[firebase-messaging-sw.js] Service worker loaded');
