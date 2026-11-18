// Bump this name whenever a production release must replace every previously
// cached application shell.  The Tickets navigation was added after v2, so
// v3 makes clients discard any bundle retained from before that release.
const CACHE_NAME = "ug-app-v3";

self.addEventListener("install", () => self.skipWaiting());

// Drop caches left by older workers so a stale index.html is never served again.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network first: every load gets the current deployment; the cache only
// answers when the network is unreachable.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("/index.html") : Response.error())))
  );
});
