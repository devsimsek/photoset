// Roll memory scenarios (PS-19 and on): metadata persistence, relink, flags.
// The remembered roll lives in localStorage under darkroom.roll; these steps
// read it back through the page, the same way the app does on boot.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { quoted, loadRoll, openApp } from './helpers.js';

const { Given, When, Then } = createBdd();

const metaOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('darkroom.roll') || 'null'));

When(/^the photographer marks (.+) as picked$/, async ({ page }, list) => {
  for (const name of quoted(list)) {
    await page.evaluate((n) => {
      const st = window.__darkroom.state;
      const i = st.photos.findIndex((p) => p.name === n);
      if (i < 0) throw new Error('no shot named ' + n);
      window.__darkroom.togglePick(i);
    }, name);
  }
});

Then(/^the roll remembers (.+)$/, async ({ page }, list) => {
  const meta = await metaOf(page);
  expect(meta).not.toBeNull();
  expect(meta.photos.map((p) => p.name).sort()).toEqual(quoted(list).sort());
});

Then('the remembered file holds only names, sizes and times', async ({ page }) => {
  const meta = await metaOf(page);
  expect(meta).not.toBeNull();
  for (const p of meta.photos) {
    for (const k of Object.keys(p)) {
      expect(['name', 'size', 'mtime', 'date']).toContain(k);
      expect(String(p[k]).length).toBeLessThan(128);
    }
  }
});

Then(/^the remembered roll lists (.+) as picked$/, async ({ page }, list) => {
  const meta = await metaOf(page);
  expect(meta.picks).toEqual(expect.arrayContaining(quoted(list)));
});

When('the darkroom is reopened', async ({ page }) => {
  await openApp(page);
});

Then(/^the roll still lists (.+) from memory$/, async ({ page }, list) => {
  const names = await page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  expect(names).toEqual(quoted(list));
});

Then('no remembered shot carries pixels', async ({ page }) => {
  const ok = await page.evaluate(() => window.__darkroom.state.photos.every((p) => p.remembered && !p.thumb));
  expect(ok).toBe(true);
});

Then('the contact sheet marks every shot as remembered', async ({ page }) => {
  const n = await page.evaluate(() => window.__darkroom.state.photos.length);
  await expect(page.locator('.roll-item.remembered')).toHaveCount(n);
});

Then('the stage asks to re-pick the folder to restore the roll', async ({ page }) => {
  const banner = page.locator('#rememberBanner');
  await expect(banner).toBeVisible();
  await expect(banner.locator('#rememberLoad')).toBeVisible();
});

Then('storage holds no image data and stays tiny', async ({ page }) => {
  const total = await page.evaluate(() => {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      bytes += k.length + v.length;
      if (/data:image/i.test(v)) throw new Error('image data stored under key ' + k);
      if (/[A-Za-z0-9+/]{300,}/.test(v)) throw new Error('large blob stored under key ' + k);
    }
    return bytes;
  });
  expect(total).toBeLessThan(5000);
});
