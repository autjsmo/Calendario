const CACHE_NAME = 'villani-app-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=50',
  './app.js?v=50',
  './manifest.json'
];

// Installazione: scarica i file nella cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Attivazione: pulisce vecchie cache se cambi versione
self.addEventListener('activate', (e) => {
  e.waitUntil(
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
});

// Fetch: serve i file dalla cache se offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});