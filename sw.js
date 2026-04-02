const CACHE_NAME = 'motolog-pwa-v1.1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icone-motolog.png'
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Atualiza o cache automaticamente quando houver mudanças
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Retorna do cache se estiver offline, caso contrário, busca na rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    }).catch(() => {
      // Se a rede falhar e não estiver no cache, força a página inicial
      return caches.match('./index.html');
    })
  );
});
