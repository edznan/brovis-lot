// Bump CACHE_NAME on every release so installed clients see the update banner.
const CACHE_NAME = "brovis-v4";

const PRECACHE = [
  "./",
  "./index.html",
  "./app.css",
  "./print.css",
  "./app.js",
  "./db.js",
  "./pdf.js",
  "./types.js",
  "./labels.js",
  "./manifest.json",
  "./brovis_logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-32.png",
  "./vendor/boxicons/css/boxicons.min.css",
  "./vendor/boxicons/fonts/boxicons.woff2",
  "./vendor/boxicons/fonts/boxicons.woff",
  "./vendor/boxicons/fonts/boxicons.ttf"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE.map((url) =>
        cache.add(new Request(url, { cache: "reload" })).catch((err) => {
          console.warn("[sw] failed to cache", url, err);
        })
      ))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response && response.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      if (req.mode === "navigate") {
        const shell = await caches.match("./index.html");
        if (shell) return shell;
      }
      return new Response(
        "<!doctype html><meta charset=utf-8><title>Offline</title><style>body{font-family:Segoe UI,system-ui,sans-serif;padding:40px;text-align:center;color:#333}</style><h1>Offline</h1><p>Ovaj resurs još nije u cache-u. Povežite se i pokušajte ponovo.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
