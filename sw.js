const CACHE_NAME = 'cistella-cache-v17';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Instal·lació del Service Worker i precaching bàsic
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Neteja de memòries cau antigues
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Eliminant cau antiga:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratègia Network-First amb fallback a Cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // No interceptar ni desar en cau streams SSE ni crides a canals de sincronització o QR externs
  if (url.hostname.includes('ntfy.sh') || url.hostname.includes('qrserver.com')) {
    return;
  }
  const acceptHeader = event.request.headers.get('accept') || '';
  if (acceptHeader.includes('text/event-stream')) {
    return;
  }

  // En desenvolupament local (127.0.0.1 o localhost), no servir index.html de memòria cau
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
      event.respondWith(fetch(event.request));
      return;
    }
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        });
      })
  );
});
