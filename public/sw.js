const CACHE_PREFIX = 'mtp-app-shell-';
const CACHE_VERSION = 'mtp-app-shell-v17';
const APP_SCOPE = new URL(self.registration.scope);
const APP_HOME = new URL('./', APP_SCOPE).toString();
const APP_SHELL = [
  APP_HOME,
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
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request) || isLiveApi(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const copy = response.clone();
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, copy);
      }
      return response;
    }).catch(async () => {
      const requestUrl = new URL(request.url);
      const legalPage = requestUrl.pathname.endsWith('/privacy.html') ? new URL('./privacy.html', APP_SCOPE).toString()
        : requestUrl.pathname.endsWith('/support.html') ? new URL('./support.html', APP_SCOPE).toString()
          : '';
      return (await caches.match(request)) ?? (legalPage ? await caches.match(legalPage) : undefined) ?? (await caches.match(APP_HOME)) ?? Response.error();
    }));
    return;
  }

  event.respondWith(caches.match(request).then(async (cached) => {
    const network = fetch(request).then((response) => {
      if (response.ok && ['script', 'style', 'image', 'font'].includes(request.destination)) {
        const copy = response.clone();
        void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.then(() => undefined).catch(() => undefined));
      return cached;
    }
    return network;
  }));
});
