import { createBdd } from 'playwright-bdd';

const { Given, When, Then, After } = createBdd();

// Pins the file-input contract of the intake for browsers WITHOUT the File
// System Access folder picker (Safari, Firefox, Android Chrome): the folder
// input must filter files out of the picker (WebKit bug 284457: Safari lets
// files be selected and then returns an empty list), and the phone input
// keeps its photo filter. Each scenario opens its own context with
// showDirectoryPicker removed before the app boots, so the intake takes the
// input path deterministically - the shared fixture's Chromium has the API,
// and whether it throws a fallback-triggering error is up to the runner.
let ctx = null;
let captured = null; // the file input the intake constructed for this scenario
let pickerPage = null; // the custom context's page the picker steps act on

async function openWithoutFolderApi(browser, mobile) {
  if (ctx) { await ctx.close(); ctx = null; }
  const options = mobile
    ? { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } };
  ctx = await browser.newContext(options);
  pickerPage = await ctx.newPage();
  await pickerPage.addInitScript(() => {
    try { delete window.showDirectoryPicker; } catch { /* older engines */ }
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
  });
  await pickerPage.goto('/');
  await pickerPage.waitForFunction(() => !!(window.api && window.__darkroom));
}

After(async () => {
  if (ctx) { await ctx.close(); ctx = null; pickerPage = null; }
});

async function hookLoadClick(page) {
  const captured = await page.evaluate((btn) => new Promise((resolve) => {
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      const out = {
        type: this.type,
        multiple: this.multiple,
        webkitdirectory: this.webkitdirectory,
        accept: this.accept,
      };
      HTMLInputElement.prototype.click = orig;
      resolve(out);
    };
    const button = document.querySelector(btn);
    if (!button) { HTMLInputElement.prototype.click = orig; resolve(null); return; }
    button.click();
    setTimeout(() => { HTMLInputElement.prototype.click = orig; resolve(null); }, 5000);
  }), '#emptyLoad, #loadBtn');
  if (!captured) throw new Error('no load control produced a file input');
  return captured;
}

Given('the darkroom is open in a browser without the folder API', async ({ browser }) => {
  await openWithoutFolderApi(browser, false);
});

Given('the darkroom is open on a phone', async ({ browser }) => {
  await openWithoutFolderApi(browser, true);
});

When('the photographer opens the load picker', async () => {
  captured = await hookLoadClick(pickerPage);
});

Then('the folder input accepts no individual files', () => {
  if (!captured.webkitdirectory) throw new Error('the desktop picker is not a folder picker');
  if (captured.accept && captured.accept !== '..') {
    throw new Error(`the folder input still filters by files (accept=${captured.accept})`);
  }
});

Then('the folder input still asks for directories', () => {
  if (!captured.multiple) throw new Error('the folder input lost multiple');
});

Then('the photo input still filters to photos', () => {
  if (captured.webkitdirectory) throw new Error('the phone picker became a folder picker');
  const want = '.jpg,.jpeg,image/jpeg,.dng,.cr3,.arw';
  if (captured.accept !== want) throw new Error(`the photo filter changed: ${captured.accept}`);
});

// ---------- the crop control explains itself (post-1.0 QA) ----------

When('the photographer selects the remembered shot {string}', async ({ page }, name) => {
  await page.evaluate((n) => {
    const st = window.__darkroom.state;
    st.sel = st.photos.findIndex((p) => p.name === n && p.remembered);
    if (st.sel < 0) throw new Error(`no remembered shot named ${n}`);
    window.__darkroom.select(st.sel);
  }, name);
});

When('the photographer clicks the crop control', async ({ page }) => {
  await page.click('#cropBtn');
});

Then('a toast names the shot as a placeholder needing a re-pick', async ({ page }) => {
  await page.waitForFunction(() => {
    const t = document.querySelector('#toast');
    return t && t.classList.contains('on') && /re-pick/i.test(t.textContent || '');
  }, { timeout: 5000 });
});

