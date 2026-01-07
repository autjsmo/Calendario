
const CACHE_NAME = 'villani-app-v50'; // aggiorna versione quando aggiorni file
const ASSETS = [
  './',
  './index.html',
  './style.css?v=50',
  './app.js?v=50',
  './manifest.json',
  './icon/icon-192.png',
  './icon/icon-512.png'
];

// Install: precache assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // passa subito allo stato waiting
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch((err) => {
        console.error('SW install - cache.addAll failed:', err);
      })
  );
});

// Activate: pulisci vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      // Prendi il controllo immediatamente delle pagine aperte
      return self.clients.claim();
    })
  );
});

// Fetch: navigation -> network-first, assets -> cache-first + revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Non interferire con richieste non-GET
  if (req.method !== 'GET') return;

  // Consideriamo navigation requests (caricamento pagine) e richieste HTML
  const acceptHeader = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || acceptHeader.includes('text/html');

  if (isNavigation) {
    // Network-first: prova rete, altrimenti fallback a index.html in cache
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // Aggiorna la cache con la nuova HTML se successo
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // mettiamo in cache per fallback future
            cache.put('./index.html', copy).catch(()=>{});
          });
          return networkResponse;
        })
        .catch(() => {
          // On failure, return cached index.html (fallback offline)
          return caches.match('./index.html');
        })
    );
    return;
  }

  // For other requests (assets: css/js/img/json), use cache-first with background update
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in background
        event.waitUntil(
          fetch(req)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(req, networkResponse.clone()).catch(()=>{});
                });
              }
            })
            .catch(()=>{/* ignore network errors during background revalidation */})
        );
        return cachedResponse;
      }

      // No cache -> fetch from network and cache if ok
      return fetch(req)
        .then((networkResponse) => {
          if (!networkResponse || !networkResponse.ok) return networkResponse;
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, respClone).catch(()=>{});
          });
          return networkResponse;
        })
        .catch(() => {
          // optional: could return a generic fallback image for images,
          // or an offline page for HTML, but not provided here.
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        });
    })
  );
});

// Permetti alla pagina di chiedere al SW di attivarsi subito
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
