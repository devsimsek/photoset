// Photoset Darkroom service worker. Plain JS; build-web.js injects VERSION.
'use strict';

const VERSION = '__BUILD_VERSION__';
const CACHE = 'photoset-shell-' + VERSION;
// The RAW decoder's cache (ADR 0004): filled on first fetch, never at install.
const DECODER = 'photoset-decoder-' + VERSION;
const DECODER_PATH = '/flashraw/';

// The build shell; keep in sync with FILES in build/build-web.js. The decoder
// wasm is NOT here: it joins cache-on-first-fetch under DECODER.
const SHELL = [
  'index.html', 'styles.css', 'app.js', 'engine.js', 'web-api.js',
  'exif.js', 'qr.js', 'pdf.js', 'icon.png', 'icon-maskable.png', 'manifest.webmanifest',
];

// Fetch instrumentation for the BDD suite: the worker answers STATS.
let handled = 0;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) {
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

  // Web Share Target: shared photos arrive as a multipart POST to the app
  // root; the worker redirects to the shell and hands the files to the page.
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

  // Decoder assets: cache-first, filled on first fetch (never precached), so
  // one decode puts every decoder byte in the cache and later decodes work offline.
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

  // Navigations are network-first so a deployed update arrives on reload.
  if (e.request.mode === 'navigate') {
    handled++;
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        // Only a real shell page enters the precache: a 404 body never replaces index.html.
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

  // Precached shell assets: cache-first, then cache-and-update for next time.
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
