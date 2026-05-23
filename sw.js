const CACHE = "the-system-v2";

const ASSETS = [
  "/The-System-PWA/",
  "/The-System-PWA/index.html",
  "/The-System-PWA/style.css",
  "/The-System-PWA/app.js",
  "/The-System-PWA/manifest.json",
  "/The-System-PWA/icon.png"
];

// Install — cache all assets
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

// Activate — clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

// Fetch — serve from cache, fall back to network
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).catch(() => cached);
    })
  );
});
