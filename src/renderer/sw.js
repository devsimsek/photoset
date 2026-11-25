// Photoset Darkroom service worker. Plain JS, no dependencies.
// build/build-web.js injects the build version into the VERSION constant at
// copy time, so every build gets its own versioned precache.
'use strict';

const VERSION = '__BUILD_VERSION__';
const CACHE = 'photoset-shell-' + VERSION;

// The whole build shell; keep in sync with FILES in build/build-web.js.
// Note (ADR 0004): the RAW decoder wasm joins this precache in the RAW wave,
// deliberately outside the 150 KB ratchet until then.
const SHELL = [
  'index.html', 'styles.css', 'app.js', 'engine.js', 'web-api.js',
  'exif.js', 'icon.png', 'icon-maskable.png', 'manifest.webmanifest',
];

// Fetch-handler instrumentation for the BDD suite and debugging: the worker
// answers { type: 'STATS' } with how many requests it has handled.
let handled = 0;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'STATS' && e.source) e.source.postMessage({ type: 'STATS', handled, version: VERSION });
});

self.addEventListener('fetch', (e) => {
  // Only GET is ever intercepted; POST/PUT/DELETE pass through untouched.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations are network-first so a deployed update arrives on reload,
  // falling back to the cached index.html when the network is gone.
  if (e.request.mode === 'navigate') {
    handled++;
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        const c = await caches.open(CACHE);
        c.put('index.html', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('index.html');
        if (cached) return cached;
        throw new Error('offline and no cached shell page');
      }
    })());
    return;
  }

  // Precached shell assets: cache-first, network fallback, then
  // cache-and-update so the next offline visit sees the fresh copy.
  if (SHELL.includes(url.pathname.split('/').pop())) {
    handled++;
    e.respondWith((async () => {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      const fresh = await fetch(e.request);
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(e.request, fresh.clone());
      }
      return fresh;
    })());
  }
});
