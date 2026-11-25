import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';
import { swContext } from './pwa.js';
import { results } from './results.js';

const { Given, When, Then, After } = createBdd();

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

// ---------- the roll loads RAW files (PS-27) ----------

// Builds a roll in the page without navigating (unlike helpers.loadRoll,
// which reloads the app): a File for the committed RAW fixture plus in-page
// JPEG bytes for the rest, handed to api.fromFiles and loadRoll.
async function loadRollInPage(page, specs, rollName) {
  return page.evaluate(async ({ specs, rollName, rawBytes }) => {
    const makeJpeg = async (busy, garbage) => {
      if (garbage) return crypto.getRandomValues(new Uint8Array(200));
      const c = document.createElement('canvas');
      c.width = busy ? 256 : 64;
      c.height = busy ? 192 : 48;
      const x = c.getContext('2d');
      if (busy) {
        const id = x.createImageData(c.width, c.height);
        let s = 0x9e3779b9 >>> 0;
        for (let i = 0; i < id.data.length; i += 4) {
          s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0;
          id.data[i] = s & 255; id.data[i + 1] = (s >>> 8) & 255; id.data[i + 2] = (s >>> 16) & 255; id.data[i + 3] = 255;
        }
        x.putImageData(id, 0, 0);
      } else {
        x.fillStyle = '#b34d2e';
        x.fillRect(0, 0, c.width, c.height);
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return new Uint8Array(await blob.arrayBuffer());
    };
    const files = [];
    for (const s of specs) {
      if (s.raw) files.push(new File([new Uint8Array(rawBytes)], s.name, { type: 'application/octet-stream' }));
      else files.push(new File([await makeJpeg(!!s.busy, !!s.garbage)], s.name, { type: 'image/jpeg' }));
    }
    const roll = window.api.fromFiles(files, rollName || '');
    await window.__darkroom.loadRoll(roll);
    return window.__darkroom.state.photos.map((p) => p.name);
  }, { specs, rollName, rawBytes: theFixture() });
}

const rawSpec = (name) => ({ name, raw: true });
const jpgSpec = (name) => ({ name });

When(/^the photographer loads a roll with the RAW fixture "(.+?)"$/, async ({ page }, name) => {
  const got = await loadRollInPage(page, [rawSpec(name)], '');
  if (got.length !== 1 || got[0] !== name) throw new Error(`expected the roll to hold only ${name}, got ${JSON.stringify(got)}`);
});

When(/^the photographer loads a roll with a JPG and the RAW fixture "(.+?)"$/, async ({ page }, name) => {
  const got = await loadRollInPage(page, [jpgSpec('a_frame.jpg'), rawSpec(name)], '');
  if (got.length !== 2) throw new Error(`expected two shots, got ${JSON.stringify(got)}`);
});

When('loads another roll with a JPG', async ({ page }) => {
  await loadRollInPage(page, [jpgSpec('a_frame.jpg')], 'other');
});

Then(/^the roll holds "(.+?)" then "(.+?)"$/, async ({ page }, a, b) => {
  const got = await page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  if (got.join('|') !== `${a}|${b}`) throw new Error(`expected [${a}, ${b}], got ${JSON.stringify(got)}`);
});

Then('both tiles grow a thumbnail', async ({ page }) => {
  await expect.poll(() => page.evaluate(() =>
    window.__darkroom.state.photos.map((p) => p.name + ':' + (p.thumb ? 'thumb' : 'none')).join('|')), { timeout: 10000 })
    .toMatch(/a_frame\.jpg:thumb\|b_shot\.dng:thumb/);
});

// ---------- preview, then decode (PS-27) ----------

Given('RAW decodes stall', async ({ page }) => {
  await page.evaluate(() => { window.api._stallDecode = 30000; });
});

When('RAW decodes stop stalling', async ({ page }) => {
  await page.evaluate(() => { window.api._stallDecode = 0; });
});

Then(/^the "(.+?)" tile shows the embedded preview$/, async ({ page }, name) => {
  await expect.poll(() => page.evaluate((n) => {
    const p = window.__darkroom.state.photos.find((q) => q.name === n);
    return p ? { rawState: p.rawState, thumb: !!p.thumb, decoded: !!p.rawSrc } : null;
  }, name), { timeout: 10000 })
    .toMatchObject({ thumb: true, rawState: 'preview', decoded: false });
});

When('the page waits for the selected RAW decode', async ({ page }) => {
  await expect.poll(() => page.evaluate(() =>
    window.__darkroom.state.photos.some((p) => p.rawState === 'decoded')), { timeout: 15000 })
    .toBe(true);
});

Then(/^the "(.+?)" tile shows a decoded thumb$/, async ({ page }, name) => {
  const st = await page.evaluate((n) => {
    const p = window.__darkroom.state.photos.find((q) => q.name === n);
    if (!p) return null;
    return { rawState: p.rawState, thumb: !!p.thumb, decoded: !!p.rawSrc, w: p.w, h: p.h };
  }, name);
  if (!st) throw new Error(`no photo named ${name}`);
  if (st.rawState !== 'decoded') throw new Error(`expected the decoded state, got rawState=${JSON.stringify(st.rawState)}`);
  if (!st.thumb) throw new Error(`${name} lost its thumbnail`);
  if (!st.decoded) throw new Error(`${name} has no decoded full source`);
  if (st.w !== 1920 || st.h !== 1080) throw new Error(`decoded dims ${st.w}x${st.h}, expected 1920x1080`);
});

// ---------- develop a RAW shot (PS-27) ----------

Then('the result is larger than {int} KB', async ({}, kb) => {
  const download = results.downloads[0];
  const buf = readFileSync(await download.path());
  if (buf.length < kb * 1024) throw new Error(`the developed result is only ${buf.length} bytes`);
});

// ---------- abort on roll change (PS-27) ----------

Then('the in-flight RAW decode was aborted', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.api._rawStats), { timeout: 10000 })
    .toMatchObject({ started: expect.any(Number), aborted: expect.any(Number) });
  const stats = await page.evaluate(() => window.api._rawStats);
  if (!stats.aborted) throw new Error(`no decode was aborted: ${JSON.stringify(stats)}`);
});

After(async () => {
  fixtureBytes = null;
});
