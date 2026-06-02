/**
 * Catalog service worker — cache-first images, stale-while-revalidate catalog JSON.
 * Served from /sw-catalog.js (public/).
 */
const CACHE = "pgt-catalog-v1";

function isCatalogApiPath(pathname) {
  return (
    pathname.startsWith("/api/img") ||
    pathname.startsWith("/api/pokedex/") ||
    pathname.startsWith("/api/catalog/")
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (hit) {
    void network;
    return hit;
  }

  const fresh = await network;
  if (fresh) return fresh;
  return Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("pgt-catalog-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!isCatalogApiPath(url.pathname)) return;

  if (url.pathname.startsWith("/api/img")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
