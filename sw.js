const CACHE_NAME = 'villani-app-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=50',
  './app.js?v=50',
  './manifest.json',
  './icon/icon-180.png',
  './icon/icon-192.png',
  './icon/icon-512.png',
  './icon/icon-192-maskable.png',
  './icon/icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
