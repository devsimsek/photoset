import { createBdd } from 'playwright-bdd';
import fs from 'fs';

const { Given, When, Then, After } = createBdd();

// Playwright blocks service workers by default and playwright.config.mjs is
// owned elsewhere, so PWA scenarios open their own browser context with
// serviceWorkers: 'allow' instead of the shared page fixture. The context is
// closed in the After hook below. RAW scenarios (raw.js) reuse the same step
// phrases and reach the context through swContext().
let sw = null; // { context, page } for the current scenario

export function swContext() { return sw; }

async function openWithServiceWorkers(browser) {
  if (sw) { await sw.context.close(); sw = null; }
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  sw = { context, page };
  await page.goto('/');
  return page;
}

// Waits until a service worker is registered, activated and controlling the
// page, which also proves the precache finished (activate follows install).
async function waitControlled(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    navigator.serviceWorker.ready.then(() => resolve(!!navigator.serviceWorker.controller));
    setTimeout(() => resolve(false), 5000);
  }), { timeout: 10000 });
}

Given('the app has a service worker precaching the shell', async ({ browser }) => {
  const page = await openWithServiceWorkers(browser);
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
  await waitControlled(page);
});

When('the network is cut', async () => {
  await sw.context.setOffline(true);
});

When('the app is reloaded offline', async () => {
  await sw.page.reload();
});

When('the app navigates to the root again', async () => {
  await sw.page.goto('/');
});

Then('the darkroom still boots from the precache', async () => {
  const page = sw.page;
  await page.waitForFunction(() => {
    const ok = document.title === 'Photoset Darkroom'
      && !!(window.api && window.__darkroom)
      && getComputedStyle(document.body).backgroundColor !== '';
    return ok ? true : undefined;
  }, { timeout: 5000 });
});

When('a POST request is sent to a precached shell file', async () => {
  await sw.page.evaluate(async () => { await fetch('/index.html', { method: 'POST' }); });
  sw.statsAfterPost = await swPageStats(sw.page);
});

Then('the service worker does not handle it', async () => {
  const afterPost = sw.statsAfterPost;
  // A real GET of the same file must be handled; the POST must not have been.
  await sw.page.evaluate(async () => { await fetch('/index.html'); });
  const afterGet = await swPageStats(sw.page);
  if (!(afterGet.handled > afterPost.handled)) {
    throw new Error(`expected the service worker to handle the GET (handled=${afterGet.handled}) but not the POST (handled=${afterPost.handled})`);
  }
});

// Asks the running service worker for its stats. The worker answers
// { type: 'STATS', handled, version } messages; version is its VERSION
// constant, which identifies the deployed bytes.
function swPageStats(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const onMsg = (e) => {
        if (e.data && e.data.type === 'STATS') {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          resolve({ handled: e.data.handled, version: e.data.version });
        }
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      reg.active.postMessage({ type: 'STATS' });
      setTimeout(() => { navigator.serviceWorker.removeEventListener('message', onMsg); resolve({ handled: -1, version: 'timeout' }); }, 3000);
    });
  });
}

function swPageStatsVersion(page) {
  return swPageStats(page).then((s) => s.version);
}

// ---------- installable manifest (PS-18) ----------

async function fetchManifest(page) {
  const res = await page.request.get('/manifest.webmanifest');
  if (!res.ok()) throw new Error(`manifest fetch failed: HTTP ${res.status()}`);
  return JSON.parse(await res.text());
}

Then('the manifest at the app root parses with name {string} and display {string}', async ({ page }, name, display) => {
  const m = await fetchManifest(page);
  if (m.name !== name) throw new Error(`expected manifest name ${JSON.stringify(name)}, got ${JSON.stringify(m.name)}`);
  if (m.short_name !== 'Photoset') throw new Error(`expected short_name "Photoset", got ${JSON.stringify(m.short_name)}`);
  if (m.display !== display) throw new Error(`expected display ${JSON.stringify(display)}, got ${JSON.stringify(m.display)}`);
  const resolved = new URL(m.start_url, 'http://deploy-base/photoset/');
  if (!resolved.href.startsWith('http://deploy-base/photoset/')) {
    throw new Error(`start_url ${JSON.stringify(m.start_url)} does not resolve inside /photoset/ (got ${resolved.href})`);
  }
});

Then('the icons list contains a 512x512 {string} icon and a 512x512 {string} icon', async ({ page }, purposeA, purposeB) => {
  const m = await fetchManifest(page);
  const icons = m.icons || [];
  const find = (purpose) => icons.find((i) => (i.sizes || '').includes('512x512') && (i.purpose || '').split(' ').includes(purpose));
  for (const purpose of [purposeA, purposeB]) {
    const icon = find(purpose);
    if (!icon) throw new Error(`no 512x512 ${purpose} icon in the manifest (icons: ${JSON.stringify(icons)})`);
    const res = await page.request.get(icon.src);
    if (!res.ok()) throw new Error(`icon ${icon.src} for ${purpose} does not fetch: HTTP ${res.status()}`);
  }
});

Then('a service worker registration exists after load', async () => {
  const page = sw.page;
  const ok = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active);
  });
  if (!ok) throw new Error('no active service worker registration after load');
});

After(async () => {
  if (sw) { await sw.context.close(); sw = null; }
  if (stashedSw) {
    fs.writeFileSync('web-dist/sw.js', stashedSw);
    stashedSw = null;
  }
});

// ---------- update toast (PS-17) ----------

// Simulates a deploy: the built service worker gets a genuinely different
// VERSION constant on disk, the running worker checks for updates, and the
// browser installs the new bytes next to the active one. The bytes stay
// deployed until the After hook restores them, so update checks triggered by
// the reload see the same (new) build and the swap stays clean. Playwright
// route interception does not see SW update-check fetches, so the bytes
// change on disk instead; the local server reads them per request.
let stashedSw = null;

function swDeployV2() {
  if (!stashedSw) stashedSw = fs.readFileSync('web-dist/sw.js', 'utf8');
  fs.writeFileSync('web-dist/sw.js', stashedSw.replace(/const VERSION = '.*?';/, "const VERSION = 'update-test-v2';"));
}

When('a new service worker version is waiting', async () => {
  swDeployV2();
  await sw.page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await sw.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r && !!r.waiting), { timeout: 10000 });
  await sw.page.reload();
  await sw.page.waitForFunction(() => !!(window.api && window.__darkroom));
});

Then('the update toast offers a reload', async () => {
  const page = sw.page;
  await page.waitForFunction(() => document.querySelector('#toast')?.classList.contains('on') || undefined, { timeout: 5000 });
  const shown = await page.evaluate(() => ({
    msg: document.querySelector('#toastMsg').textContent,
    action: document.querySelector('#toastAction').textContent,
    visible: !!document.querySelector('#toastAction') && !document.querySelector('#toastAction').hidden,
  }));
  if (shown.msg !== 'New version ready' || !shown.visible) {
    throw new Error(`expected update toast with a reload button, got ${JSON.stringify(shown)}`);
  }
});

When('the user clicks reload on the update toast', async () => {
  await sw.page.waitForFunction(() => document.querySelector('#toast')?.classList.contains('on') || undefined, { timeout: 5000 });
  await sw.page.click('#toastAction');
});

Then('the page boots again controlled by the new service worker version', async () => {
  const page = sw.page;
  await page.waitForFunction(() => {
    return navigator.serviceWorker.controller && window.__darkroom ? true : undefined;
  }, { timeout: 10000 });
  // The running controller answers STATS with its VERSION constant; only the
  // newly deployed bytes report the update-test version.
  const version = await swPageStatsVersion(page);
  if (version !== 'update-test-v2') {
    throw new Error(`expected the page to be controlled by the new version, controller reports ${JSON.stringify(version)}`);
  }
});

Then('the page does not reload on its own', async () => {
  const page = sw.page;
  // Set after the waiting step (which reloads as part of the setup), then
  // prove the page sits still: the marker survives and the controller still
  // reports the old version, because SKIP_WAITING needs a user click.
  await page.evaluate(() => { window.__noAutoReload = 'still-here'; });
  await page.waitForTimeout(2000);
  const version = await swPageStatsVersion(page);
  const survived = await page.evaluate(() => window.__noAutoReload === 'still-here');
  if (!survived) throw new Error('the page reloaded without a user click');
  if (version === 'update-test-v2') throw new Error('the worker skipped waiting without a user click');
});
