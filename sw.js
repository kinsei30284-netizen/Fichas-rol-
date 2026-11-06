/* Service Worker para GitHub Pages: cachea la interfaz y recursos estáticos; nunca cachea Firebase/API. */
const CACHE_NAME = 'rpg-shell-v1';
const APP_ROOT = new URL('./', self.registration.scope);
const APP_INDEX = new URL('index.html', APP_ROOT).toString();
const PRECACHE = [APP_ROOT.toString(), APP_INDEX];
const STATIC_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('rpg-shell-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Nunca guardar autenticación, base de datos, APIs ni datos dinámicos de Firebase.
  if (/firebaseio\.com$|firebasedatabase\.app$|identitytoolkit|securetoken|googleapis\.com|firebaseapp\.com/.test(url.hostname + url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && new URL(response.url).origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(APP_INDEX, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(APP_INDEX)) || (await caches.match(APP_ROOT)) || Response.error();
      }
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const allowedStatic = STATIC_HOSTS.has(url.hostname);
  if (!sameOrigin && !allowedStatic) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && (sameOrigin || allowedStatic)) cache.put(request, response.clone());
      return response;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
