const CACHE_VERSION = 'mtp-app-shell-v5';
const APP_SCOPE = new URL(self.registration.scope);
const APP_SHELL = [
  new URL('./', APP_SCOPE).toString(),
  new URL('./privacy.html', APP_SCOPE).toString(),
  new URL('./support.html', APP_SCOPE).toString(),
  new URL('./manifest.webmanifest', APP_SCOPE).toString(),
  new URL('./icons/icon.svg', APP_SCOPE).toString()
];

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;
const isLiveApi = (request) => {
  const url = new URL(request.url);
  return /overpass|open-meteo|frankfurter|wikimedia|wikidata|wikipedia|nominatim/i.test(url.hostname);
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))) .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request) || isLiveApi(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(new URL('./', APP_SCOPE).toString(), copy));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached ?? caches.match(new URL('./', APP_SCOPE).toString()))));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
    if (response.ok && ['script', 'style', 'image', 'font'].includes(request.destination)) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
