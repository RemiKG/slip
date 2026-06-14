/* Slip — service worker.
 *
 * Makes the app work fully offline after the first visit (the equity / airplane-mode
 * promise), and makes it installable. It does NOT touch audio or the model analysis —
 * those are 100% in the page. The big phoneme model is cached by transformers.js itself
 * (Cache API), so this worker deliberately ignores cross-origin model fetches.
 *
 * Offline strategy without a build manifest: the page tells the worker exactly which
 * same-origin assets it loaded (via the Performance API → a "warm" message), the worker
 * caches them, and navigations match cache-first with ignoreSearch — so reloading any
 * route while offline serves the cached shell and the app boots and re-analyses locally.
 *
 * The live "0 network calls" ledger is measured in-page (lib/network.ts) and is
 * corroborable in DevTools › Network.
 */
const VERSION = "slip-v3";
const CACHE = `slip-${VERSION}`;

// Small, stable, same-origin assets every screen needs — precached on install so the app
// renders fully offline even on screens you never visited online. (The big model caches
// itself via transformers.js; tesseract caches its own data on first OCR.)
const ICONS = [
  "again", "arrow-right", "back", "camera", "check", "chip", "close", "download", "gear",
  "globe", "info", "keyboard", "mic", "paste", "pencil", "play", "share", "shield",
  "sliders", "sparkle", "trash", "wave", "wifi-off",
].map((n) => `/art/ic-${n}.png`);
const CRITICAL = [
  "/",
  ...ICONS,
  "/art/ear.png", "/art/ear-happy.png", "/art/ear-listen.png",
  "/art/wordmark.png", "/art/mark.png", "/art/app-icon.png",
  "/fonts/Fredoka.ttf", "/fonts/Lexend.ttf", "/fonts/Inter.ttf", "/fonts/JetBrainsMono.ttf",
  "/demo/thrush-1.wav", "/demo/thrush-2.wav", "/demo/sheep-1.wav",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // individual adds so one failure doesn't abort the whole precache
      await Promise.allSettled(CRITICAL.map((u) => cache.add(u)));
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

// The page sends the exact list of same-origin assets it loaded; cache them for offline.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        data.urls.map(async (u) => {
          try {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin) return; // model etc. handled elsewhere
            const match = await cache.match(url);
            if (match) return;
            const r = await fetch(url, { cache: "no-cache" });
            if (r && r.status === 200) await cache.put(url, r.clone());
          } catch {
            /* skip anything that won't cache */
          }
        })
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache POSTs (e.g. the opt-in server seam)
  const url = new URL(req.url);
  if (!sameOrigin(url)) return; // let the model CDN (transformers.js cache) pass through

  const isNav = req.mode === "navigate";
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: isNav });
      if (cached) return cached;
      try {
        const r = await fetch(req);
        if (r && r.status === 200 && r.type === "basic") cache.put(req, r.clone());
        return r;
      } catch (err) {
        if (isNav) {
          const fallback = await cache.match("/", { ignoreSearch: true });
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
