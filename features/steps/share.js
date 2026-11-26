// Share target scenarios (PS-35). A launch is stubbed in page context before
// the app boots, the same pattern the paste scenarios use; the files travel
// through the real intake (pastePhoto), so the roll ends up with real JPEGs.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { openApp } from './helpers.js';
import { swContext } from './pwa.js';

const { Given, When, Then } = createBdd();

Given('the darkroom is open and handles share launches', async ({ page }) => {
  await page.addInitScript(() => {
    // Chromium ships a native launchQueue accessor; plain assignment fails, so
    // the stub replaces the property outright.
    Object.defineProperty(window, 'launchQueue', {
      value: { setConsumer: (fn) => { window.__launchConsumer = fn; } },
      configurable: true,
      writable: true,
    });
  });
  await openApp(page);
  const ok = await page.evaluate(() => typeof window.__launchConsumer === 'function');
  if (!ok) throw new Error('the app never registered a share launch consumer');
});

When(/^the OS shares "(.+?)" into Photoset$/, async ({ page }, name) => {
  await page.evaluate(async (n) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    c.getContext('2d').fillStyle = '#356b8a';
    c.getContext('2d').fillRect(0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const file = new File([blob], n, { type: 'image/jpeg' });
    await window.__launchConsumer({ files: [file], targetURL: '/?title=hello&text=world' });
  }, name);
  await page.waitForTimeout(300);
});

When('the OS shares nothing into Photoset', async ({ page }) => {
  await page.evaluate(() => window.__launchConsumer({ files: [], targetURL: '/?title=hello' }));
  await page.waitForTimeout(200);
});

Then('the share refuses with a toast naming the share', async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no share refusal toast appeared' },
  ).toMatch(/share/i);
});

Then('the roll stays empty', async ({ page }) => {
  const names = await page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  expect(names).toEqual([]);
});

Then('the manifest declares a share target whose action resolves inside the app path', async ({ page }) => {  const res = await page.request.get('/manifest.webmanifest');
  if (!res.ok()) throw new Error(`manifest fetch failed: HTTP ${res.status()}`);
  const m = await res.json();
  const st = m.share_target;
  if (!st) throw new Error('the manifest declares no share_target');
  if (st.method !== 'POST' || st.enctype !== 'multipart/form-data') {
    throw new Error(`shared files need POST and multipart/form-data, got method=${JSON.stringify(st.method)} enctype=${JSON.stringify(st.enctype)}`);
  }
  const files = st.params && st.params.files;
  if (!Array.isArray(files) || !files.length) throw new Error('the share target accepts no files');
  const accepts = files.flatMap((f) => [].concat(f.accept || []));
  if (!accepts.some((a) => /jpe?g/i.test(a))) throw new Error(`JPEG is not in the accepted types: ${JSON.stringify(accepts)}`);
  const resolved = new URL(st.action, 'http://deploy-base/photoset/');
  if (!resolved.href.startsWith('http://deploy-base/photoset/')) {
    throw new Error(`share target action ${JSON.stringify(st.action)} does not resolve inside /photoset/ (got ${resolved.href})`);
  }
});

// The real share path: Chrome POSTs the shared files to the action URL and
// the service worker hands them to the page. Posted from the page context so
// the worker (not the test client) sees the request.
When(/^a share POST with "(.+?)" arrives at the share target$/, async ({}, name) => {
  const page = swContext().page;
  await page.evaluate(async (n) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    c.getContext('2d').fillStyle = '#8a356b';
    c.getContext('2d').fillRect(0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const fd = new FormData();
    fd.append('photos', new File([blob], n, { type: 'image/jpeg' }));
    await fetch('/', { method: 'POST', body: fd });
  }, name);
  await page.waitForTimeout(300);
});

// The service worker scenario's roll read goes to the sw context's page, not
// the shared page fixture.
Then(/^the roll holds exactly (.+)$/, async ({}, list) => {
  const { quoted } = await import('./helpers.js');
  const expected = quoted(list);
  const got = await swContext().page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  expect([...got].sort()).toEqual([...expected].sort());
});
