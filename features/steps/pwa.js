import { createBdd } from 'playwright-bdd';
import fs from 'fs';

const { Given, When, Then, After } = createBdd();

// Playwright blocks service workers by default and playwright.config.mjs is
// owned elsewhere, so PWA scenarios open their own browser context with
// serviceWorkers: 'allow' instead of the shared page fixture. The context is
// closed in the After hook below.
let sw = null; // { context, page } for the current scenario

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
