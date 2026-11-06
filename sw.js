
/* Service Worker RPG - GitHub Pages
   HTML, JS y CSS: Network First.
   Imágenes y recursos secundarios: Cache First.
   Firebase y APIs: nunca se almacenan.
*/

const CACHE_NAME = 'rpg-shell-v2';
const APP_ROOT = new URL('./', self.registration.scope);
const APP_INDEX = new URL('index.html', APP_ROOT).toString();

const PRECACHE = [
  APP_ROOT.toString(),
  APP_INDEX
];

const STATIC_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'
]);

function esRecursoDinamico(url) {
  const host = url.hostname;
  const path = url.pathname;

  return (
    /firebaseio\.com$|firebasedatabase\.app$/.test(host) ||
    /identitytoolkit|securetoken|firebaseapp\.com/.test(host + path) ||
    /googleapis\.com$/.test(host)
  );
}

function esCodigo(request, url) {
  return (
    request.mode === 'navigate' ||
    /\.(?:html?|js|mjs|css)$/i.test(url.pathname)
  );
}

async function guardarEnCache(cache, request, response) {
  if (response && response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
}

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

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith('rpg-shell-') &&
          key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (esRecursoDinamico(url)) return;

  const sameOrigin = url.origin === self.location.origin;
  const allowedStatic = STATIC_HOSTS.has(url.hostname);

  if (!sameOrigin && !allowedStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // HTML, JavaScript y CSS: primero intenta obtener la versión nueva.
    if (esCodigo(request, url)) {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          await guardarEnCache(
            cache,
            request.mode === 'navigate' ? APP_INDEX : request,
            response
          );
        }

        return response;
      } catch (_) {
        const cached = await cache.match(
          request.mode === 'navigate' ? APP_INDEX : request
        );

        return cached || Response.error();
      }
    }

    // Imágenes, fuentes y recursos secundarios: primero la caché.
    const cached = await cache.match(request);

    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (response && response.ok) {
        await guardarEnCache(cache, request, response);
      }

      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
