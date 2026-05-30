const CACHE = "the-system-v4";

const ASSETS = [
  "/The-System-PWA/",
  "/The-System-PWA/index.html",
  "/The-System-PWA/style.css",
  "/The-System-PWA/app.js",
  "/The-System-PWA/manifest.json",
  "/The-System-PWA/icon.png"
];

self.addEventListener("install", e => {
  console.log("SW installing...");
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log("Caching assets...");
      return Promise.all(
        ASSETS.map(url =>
          fetch(url, { cache: "reload" })
            .then(res => {
              if (!res.ok) throw new Error(`Failed: ${url}`);
              return cache.put(url, res);
            })
            .catch(err => console.log("Cache fail:", url, err))
        )
      );
    }).then(() => {
      console.log("All assets cached!");
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log("Deleting old cache:", k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        console.log("Serving from cache:", e.request.url);
        return cached;
      }
      return fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match("/The-System-PWA/index.html"));
    })
  );
});
