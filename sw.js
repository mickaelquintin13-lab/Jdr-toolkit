const CACHE = 'boite-outils-v4';

// Fichiers à mettre en cache dès l'installation
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './bg-login.png'
];

// Domaines Firebase/Google : jamais interceptés
const BYPASS = ['firebase', 'googleapis', 'gstatic', 'firestore', 'google-analytics'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({type:'window'}))
      .then(clients => clients.forEach(c => c.postMessage({type:'SW_UPDATED'})))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Laisser passer toutes les requêtes Firebase/Google directement au réseau
  if (BYPASS.some(d => url.hostname.includes(d))) return;

  // Compendiums JSON : network-first, fallback cache (gros fichiers mis en cache au premier chargement)
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Tout le reste : cache-first, fallback réseau
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      });
    })
  );
});
