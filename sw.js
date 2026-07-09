/**
 * Service Worker for Fridge Monitor PWA
 * Handles offline caching and background sync
 */

const CACHE_NAME = 'fridge-monitor-v1.1.0';

// App shell files: always fetched from network first so edits go live
// immediately, without needing to bump CACHE_NAME on every deploy.
// Cache is only used as an offline fallback.
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

// Version-pinned external libraries (CDN) - safe to cache-first since the
// URL itself changes whenever the version changes.
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js'
];

// Same-origin file types that change with app updates and should always be
// revalidated against the network first (HTML/JS/CSS/JSON app shell).
const NETWORK_FIRST_EXTENSIONS = ['.html', '.js', '.css', '.json'];

function isNetworkFirst(urlObj) {
  if (urlObj.origin !== self.location.origin) {
    return false;
  }
  if (urlObj.pathname === '/' || urlObj.pathname.endsWith('/')) {
    return true;
  }
  return NETWORK_FIRST_EXTENSIONS.some(ext => urlObj.pathname.endsWith(ext));
}

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
        // Bypass the HTTP cache so the app shell is primed with genuinely
        // fresh files, then cache the version-pinned CDN assets normally.
        const staticRequests = STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }));
        return Promise.all([
          cache.addAll(staticRequests),
          cache.addAll(EXTERNAL_ASSETS)
        ]);
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
 * Cache-then-network-update helper: return whatever's cached immediately,
 * but always refresh the cache in the background so the *next* load is current.
 */
function staleWhileRevalidate(event, request, url) {
  return caches.match(request).then(cachedResponse => {
    const networkFetch = fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            if (shouldCache(url)) {
              cache.put(request, responseToCache).catch(() => {});
            }
          });
        }
        return networkResponse;
      })
      .catch(() => null);

    if (cachedResponse) {
      // Keep the SW alive long enough for the background refresh to finish,
      // without making the current response wait on it.
      event.waitUntil(networkFetch);
      return cachedResponse;
    }

    return networkFetch.then(networkResponse => {
      if (networkResponse) {
        return networkResponse;
      }
      throw new Error('Network fetch failed and no cache available');
    });
  });
}

/**
 * Network-first helper: always try the network so app-shell edits go live
 * immediately; fall back to cache (or the cached index.html) when offline.
 */
function networkFirst(request, url) {
  return fetch(request)
    .then(networkResponse => {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (shouldCache(url)) {
            cache.put(request, responseToCache).catch(() => {});
          }
        });
      }
      return networkResponse;
    })
    .catch(() => {
      return caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
        throw new Error('Fetch failed and no cache available');
      });
    });
}

/**
 * Fetch event - network-first for the app shell (always fresh), stale-while-
 * revalidate for pinned CDN/icon assets (fast, still self-updating).
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

  const urlObj = new URL(url);

  event.respondWith(
    isNetworkFirst(urlObj)
      ? networkFirst(event.request, url)
      : staleWhileRevalidate(event, event.request, url)
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
