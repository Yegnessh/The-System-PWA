const CACHE = "the-system-v3";

const ASSETS = [
  "/The-System-PWA/",
  "/The-System-PWA/index.html",
  "/The-System-PWA/style.css",
  "/The-System-PWA/app.js",
  "/The-System-PWA/manifest.json",
  "/The-System-PWA/icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
      .catch(() => caches.match("/The-System-PWA/index.html")))
  );
});
