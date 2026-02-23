/**
 * Service Worker for Fridge Monitor PWA
 * Handles offline caching and background sync
 */

const CACHE_NAME = 'fridge-monitor-v1.0.0';

// Files to cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/charts.js',
  './js/notifications.js',
  './js/firebase-config.js',
  './js/pdf-export.js',
  './js/onboarding.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// External libraries (CDN)
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
];

/**
 * Check if URL should be cached
 */
function shouldCache(url) {
  // Parse URL
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    console.warn('Invalid URL:', url);
    return false;
  }

  const scheme = urlObj.protocol;
  const hostname = urlObj.hostname;

  // ❌ Don't cache these schemes
  if (scheme === 'chrome-extension:' || 
      scheme === 'chrome:' || 
      scheme === 'about:' ||
      scheme === 'data:' ||
      scheme === 'blob:') {
    return false;
  }

  // ❌ Don't cache analytics/tracking
  if (hostname.includes('google-analytics.com') ||
      hostname.includes('googletagmanager.com') ||
      hostname.includes('doubleclick.net')) {
    return false;
  }

  // ✅ Cache same-origin requests
  if (urlObj.origin === self.location.origin) {
    return true;
  }

  // ✅ Cache whitelisted external assets
  if (EXTERNAL_ASSETS.some(asset => url.startsWith(asset))) {
    return true;
  }

  // ✅ Cache CDN resources
  if (hostname.includes('cdn.jsdelivr.net') ||
      hostname.includes('cdnjs.cloudflare.com') ||
      hostname.includes('gstatic.com')) {
    return true;
  }

  return false;
}

/**
 * Install event - cache static assets
 */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.concat(EXTERNAL_ASSETS));
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Install failed:', err);
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
      .catch(err => {
        console.error('[SW] Activation failed:', err);
      })
  );
});

/**
 * Fetch event - serve from cache with network fallback
 */
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip if shouldn't cache
  if (!shouldCache(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Check if valid response
            if (!networkResponse || 
                networkResponse.status !== 200 || 
                networkResponse.type === 'error') {
              return networkResponse;
            }

            // Clone response (can only read once)
            const responseToCache = networkResponse.clone();

            // Cache the response
            caches.open(CACHE_NAME)
              .then(cache => {
                // Double check before caching
                if (shouldCache(url)) {
                  cache.put(event.request, responseToCache)
                    .catch(err => {
                      // Silently fail - don't break the app
                      console.warn('[SW] Cache put failed:', err.message);
                    });
                }
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Fetch failed:', error);
            
            // Return offline page or fallback
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

/**
 * Background Sync (optional - for future use)
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-temperature-data') {
    event.waitUntil(
      // Sync logic here
      Promise.resolve()
    );
  }
});

/**
 * Push Notification (handled by Firebase)
 */
self.addEventListener('push', event => {
  // Firebase handles this
  console.log('[SW] Push event received');
});

/**
 * Notification Click
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(self.location.origin)
  );
});

console.log('[SW] Service Worker loaded');
