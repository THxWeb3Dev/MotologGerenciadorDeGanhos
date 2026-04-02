const cacheName = 'motolog-v1';
const staticAssets = ['./', './index.html', './style.css', './script.js', './manifest.json'];

self.addEventListener('install', async e => {
  const cache = await caches.open(cacheName);
  await cache.addAll(staticAssets);
  return self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

