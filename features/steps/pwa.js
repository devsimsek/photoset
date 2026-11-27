import { createBdd } from 'playwright-bdd';
import fs from 'fs';
import path from 'path';
import { spawn } from 'node:child_process';

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

When('the app navigates to a page that is not found', async () => {
  // A stale bookmark or a missing docs path: the server answers 404 with a
  // non-app HTML body. The shell must never cache it as index.html.
  await sw.page.goto('/definitely-missing/', { waitUntil: 'load' });
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
  if (privateSrv) {
    privateSrv.child.kill();
    fs.rmSync(privateSrv.root, { recursive: true, force: true });
    privateSrv = null;
  }
});

Given('the app runs on a private origin with a service worker precaching the shell', async ({ browser }) => {
  await openPrivateOrigin(browser);
});

// ---------- update toast (PS-17) ----------
// The three update scenarios run on a PRIVATE origin: their own server, on a
// random port, serving a COPY of web-dist. The suite's workers share the main
// origin (5179) and its one registration, so a deploy here would race every
// concurrently running test's update checks - the recorded CI stick (three
// occurrences). A private origin isolates the registration, the bytes and the
// caches; the server and its temp copy die with the scenario.

let privateSrv = null; // { child, port, root }

async function openPrivateOrigin(browser) {
  if (privateSrv) { privateSrv.child.kill(); privateSrv = null; }
  const port = 5200 + Math.floor(Math.random() * 700);
  const root = `.tmp/sw-isolate-${port}`;
  fs.cpSync('web-dist', root, { recursive: true });
  const child = spawn(process.execPath, ['-e', `
    const http = require('http'), fs = require('fs'), path = require('path');
    const root = ${JSON.stringify(process.cwd() + '/' + root)};
    const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    http.createServer((req, res) => {
      const rel = req.url.split('?')[0];
      const file = path.join(root, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    }).listen(${port}, '127.0.0.1');
  `], { stdio: 'ignore' });
  privateSrv = { child, port, root };
  // The spawned server needs a moment to listen: poll until it answers.
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    up = await fetch(`http://127.0.0.1:${port}/sw.js`).then((r) => r.ok).catch(() => false);
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) throw new Error(`private server never came up on port ${port}`);
  if (sw) { await sw.context.close(); sw = null; }
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  sw = { context, page };
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(400); // let install finish before the scenario acts
}

async function swDeployV2() {
  // The built sw is minified (ADR 0005), so the version swap keys on the
  // version STRING itself, not on a source-shaped declaration. The running
  // worker reports its version through STATS; that exact string is unique in
  // the file, so replacing every occurrence deploys genuinely new bytes.
  const swPath = path.join(privateSrv.root, 'sw.js');
  const bytes = fs.readFileSync(swPath, 'utf8');
  const current = await swPageStats(sw.page);
  if (current.version === 'timeout') throw new Error('running sw did not report its version; cannot deploy v2');
  fs.writeFileSync(swPath, bytes.split(JSON.stringify(current.version)).join(JSON.stringify('update-test-v2')));
}

When('a new service worker version is waiting', async () => {
  await swDeployV2();
  await sw.page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await sw.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r && !!r.waiting), { timeout: 10000 });
  await sw.page.reload();
  await sw.page.waitForFunction(() => !!(window.api && window.__darkroom));
});

// ---------- atomic shell (PS-59) ----------
// A deploy must never hand the browser a new index.html with old cached
// parts: the mixed shell is how a stale app.js rendered an empty rotate
// select on the owner's Safari. The navigation therefore serves the CACHED
// page of the running version; new bytes arrive only through the update
// toast's atomic swap.

When('a new version is deployed with a marker in its page', async () => {
  const swPath = path.join(privateSrv.root, 'index.html');
  let html = fs.readFileSync(swPath, 'utf8');
  html = html.replace('</body>', '<div id="v2marker">MIXED SHELL MARKER</div></body>');
  fs.writeFileSync(swPath, html);
  await swDeployV2(); // the new build's sw + page deploy together
  await sw.page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await sw.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r && !!r.waiting), { timeout: 10000 });
});

When('the page is reloaded without accepting the update', async () => {
  await sw.page.reload();
  await sw.page.waitForFunction(() => !!(window.api && window.__darkroom));
});

Then('the shell stays consistent: the marker is not in the page', async () => {
  const marker = await sw.page.evaluate(() => document.querySelector('#v2marker')?.textContent || null);
  if (marker) throw new Error('the fresh page body was served with the old cached parts: mixed shell');
});

Then('the old cached page is served until the user accepts the update', async () => {
  const reg = await sw.page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { waiting: !!r?.waiting, controller: !!navigator.serviceWorker.controller };
  });
  if (!reg.waiting) throw new Error('no waiting worker: the deploy did not stage an update');
  if (!reg.controller) throw new Error('no controller: the page is running raw network bytes');
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
  // newly deployed bytes report the update-test version. The click triggers a
  // page reload plus SKIP_WAITING/claim, so the check polls with real settling
  // time between attempts: five zero-delay retries raced the navigation and
  // gave up mid-swap once on CI (this flake repeated; the wait is the fix).
  let version = null;
  for (let i = 0; i < 20 && version !== 'update-test-v2'; i++) {
    try {
      version = await swPageStatsVersion(page);
    } catch (e) {
      if (!/Execution context was destroyed|Target closed/i.test(String(e?.message ?? e))) throw e;
    }
    if (version !== 'update-test-v2') {
      await page.waitForTimeout(500);
      await page.waitForFunction(() => !!(window.api && window.__darkroom), { timeout: 10000 }).catch(() => {});
    }
  }
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
