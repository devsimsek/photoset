// Photoset Darkroom service worker. Plain JS, no dependencies.
// build/build-web.js injects the build version into the VERSION constant at
// copy time, so every build gets its own versioned precache.
'use strict';

const VERSION = '__BUILD_VERSION__';
const CACHE = 'photoset-shell-' + VERSION;
// The RAW decoder's own cache (ADR 0004): filled on first fetch, never at
// install time, so the first-load weight stays the shell. It dies with its
// shell version, so an updated app re-fetches the decoder once.
const DECODER = 'photoset-decoder-' + VERSION;
// Requests for the self-hosted decoder files (copied from the flashraw
// package by build/build-web.js) go through this cache-on-first-fetch rule.
const DECODER_PATH = '/flashraw/';

// The whole build shell; keep in sync with FILES in build/build-web.js.
// Note (ADR 0004): the RAW decoder wasm is NOT in this list; it joins
// cache-on-first-fetch in the DECODER cache when a RAW file is first decoded.
const SHELL = [
  'index.html', 'styles.css', 'app.js', 'engine.js', 'web-api.js',
  'exif.js', 'qr.js', 'icon.png', 'icon-maskable.png', 'manifest.webmanifest',
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
      // The decoder cache dies with its shell version: a fresh app keeps one
      // decoder cache, older ones are dropped.
      if (name !== CACHE && name !== DECODER) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'STATS' && e.source) e.source.postMessage({ type: 'STATS', handled, version: VERSION });
  // Decoder-cache introspection for the BDD suite and debugging.
  if (d.type === 'DECODER_STATS' && e.source) {
    caches.keys().then(async (keys) => {
      const name = keys.find((k) => k.startsWith('photoset-decoder-'));
      const entries = name ? (await (await caches.open(name)).keys()).map((r) => r.url) : [];
      e.source.postMessage({ type: 'DECODER_STATS', cache: name || null, entries });
    });
  }
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Web Share Target: shared photos arrive as a multipart POST to the action
  // (the app root). The worker answers with a redirect to the shell and hands
  // the files to the page, where they run the same intake as a paste. The
  // POST itself never touches the cache.
  if (e.request.method === 'POST' && url.pathname === new URL('./', self.location).pathname) {
    handled++;
    e.respondWith(Response.redirect(new URL('./', self.location).href, 303));
    e.waitUntil((async () => {
      let files = [];
      try {
        files = [...(await e.request.formData()).getAll('photos')].filter((f) => f && typeof f.arrayBuffer === 'function');
      } catch { /* no usable form data: the page answers with a named toast */ }
      const client = (e.resultingClientId && await self.clients.get(e.resultingClientId))
        || (e.clientId && await self.clients.get(e.clientId))
        || (await self.clients.matchAll({ type: 'window' }))[0];
      if (client) client.postMessage({ type: 'share', files });
    })());
    return;
  }

  // Only GET is ever intercepted beyond this point; POST/PUT/DELETE pass through untouched.
  if (e.request.method !== 'GET') return;

  // Decoder assets: cache-first with network fallback, filled on first fetch
  // (never precached at install). The decoder's glue imports and the wasm
  // fetches inside its workers are intercepted here too, so one decode puts
  // every decoder byte in the cache and later decodes work offline.
  if (url.pathname.includes(DECODER_PATH)) {
    handled++;
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      const fresh = await fetch(e.request);
      if (fresh && fresh.ok) {
        const c = await caches.open(DECODER);
        c.put(e.request, fresh.clone());
      }
      return fresh;
    })());
    return;
  }

  // Navigations are network-first so a deployed update arrives on reload,
  // falling back to the cached index.html when the network is gone.
  if (e.request.mode === 'navigate') {
    handled++;
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        // Only a real shell page enters the precache: a 404 or 500 body must
        // never replace index.html, or the offline boot serves the error page.
        if (fresh && fresh.ok) {
          const c = await caches.open(CACHE);
          c.put('index.html', fresh.clone());
        }
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
