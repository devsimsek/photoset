import { createBdd } from 'playwright-bdd';

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

// Asks the running service worker how many fetches it has handled. The worker
// answers { type: 'STATS', handled } messages.
function swPageStats(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const onMsg = (e) => {
        if (e.data && e.data.type === 'STATS') {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          resolve({ handled: e.data.handled });
        }
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      reg.active.postMessage({ type: 'STATS' });
      setTimeout(() => { navigator.serviceWorker.removeEventListener('message', onMsg); resolve({ handled: -1 }); }, 3000);
    });
  });
}

After(async () => {
  if (sw) { await sw.context.close(); sw = null; }
});
