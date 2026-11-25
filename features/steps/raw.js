import { createBdd } from 'playwright-bdd';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';
import { swContext } from './pwa.js';

const { When, Then, After } = createBdd();

const FIXTURE = 'features/fixtures/blackmagic-micro-cinema-camera.dng';

// The committed fixture bytes, read once per scenario run.
let fixtureBytes = null;
function theFixture() {
  if (!fixtureBytes) fixtureBytes = new Uint8Array(readFileSync(FIXTURE));
  return fixtureBytes;
}

// Asks the running service worker what sits in its decoder cache.
// The worker answers { type: 'DECODER_STATS', cache, entries }.
function decoderStats(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const on = (e) => {
        if (e.data && e.data.type === 'DECODER_STATS') {
          navigator.serviceWorker.removeEventListener('message', on);
          resolve({ cache: e.data.cache, entries: e.data.entries });
        }
      };
      navigator.serviceWorker.addEventListener('message', on);
      reg.active.postMessage({ type: 'DECODER_STATS' });
      setTimeout(() => { navigator.serviceWorker.removeEventListener('message', on); resolve({ cache: null, entries: [] }); }, 3000);
    });
  });
}

// The page of the service-worker context opened by
// "the app has a service worker precaching the shell" (steps/pwa.js).
function swPage() {
  const sw = swContext();
  if (!sw) throw new Error('no service-worker context: open one with "the app has a service worker precaching the shell"');
  return sw.page;
}

// Decodes the committed fixture through window.api.decodeRaw. The bytes are
// fetched from the served fixture on the first call and then kept in the page,
// so a later offline decode exercises the decoder cache, not the network.
// Scenarios that opened a service-worker context observe that context's page,
// not the shared fixture.
async function decodeFixture(sharedPage) {
  const page = swContext() ? swPage() : sharedPage;
  await page.evaluate(async (bytes) => {
    if (!window.__rawFixture) window.__rawFixture = bytes;
    return window.__decodedFixture = await window.api.decodeRaw(new Blob([window.__rawFixture]));
  }, theFixture());
}

When('the page decodes the RAW fixture', async ({ page }) => {
  await decodeFixture(page);
});

Then('the decoded canvas is {int}x{int}', async ({ page }, w, h) => {
  const dims = await (swContext() ? swPage() : page).evaluate(() => {
    const c = window.__decodedFixture;
    return { w: c.width, h: c.height, px: c.getContext('2d').getImageData(0, 0, 1, 1).data.length };
  });
  if (dims.w !== w || dims.h !== h) throw new Error(`expected a ${w}x${h} canvas, got ${dims.w}x${dims.h}`);
  if (dims.px !== 4) throw new Error(`the canvas is not RGBA (pixel bytes: ${dims.px})`);
});

Then('the page has fetched nothing under {string}', async ({ page }, dir) => {
  const hits = await page.evaluate((part) =>
    performance.getEntriesByType('resource').filter((r) => r.name.includes('/' + part + '/')).map((r) => r.name), dir);
  if (hits.length) throw new Error(`the app fetched decoder assets at boot: ${hits.join(', ')}`);
});

Then('the decoder assets sit in the decoder cache', async () => {
  const stats = await decoderStats(swPage());
  if (!stats.cache || !stats.cache.startsWith('photoset-decoder-')) {
    throw new Error(`no decoder cache exists (caches: ${JSON.stringify(stats)})`);
  }
  const wasm = stats.entries.filter((u) => u.endsWith('.wasm'));
  if (!wasm.length) throw new Error(`no .wasm in the decoder cache: ${stats.entries.join(', ')}`);
  if (stats.entries.length < 5) throw new Error(`decoder cache too thin: ${stats.entries.join(', ')}`);
});

// "the app has a service worker precaching the shell" and "the network is cut"
// are the PWA steps (steps/pwa.js); raw.feature reuses them, and reaches the
// context they open through swContext().

After(async () => {
  fixtureBytes = null;
});
