// Roll memory scenarios (PS-19 and on): metadata persistence, relink, flags.
// The remembered roll lives in localStorage under darkroom.roll; these steps
// read it back through the page, the same way the app does on boot.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { quoted, loadRoll, openApp, zipEntries } from './helpers.js';
import { results } from './results.js';

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

// ---------- relink (PS-20) ----------

// Seeds a remembered roll straight into storage, then reboots so the boot path
// sees it. mtime is a fixed stamp; sizes are fake but tiny.
Given(/^a remembered roll "(.+?)" whose shots (.+) reached "(strip_\d+)"$/, async ({ page }, rollName, list, lastStrip) => {
  await openApp(page);
  await page.evaluate(({ rollName, names, lastStrip }) => {
    localStorage.setItem('darkroom.roll', JSON.stringify({
      schema: 1, name: rollName, savedAt: Date.now(),
      photos: names.map((n) => ({ name: n, size: 1234, mtime: 1700000000000 })),
      picks: [], perPhoto: {},
      stripHigh: Number(lastStrip.match(/\d+/)[0]),
    }));
  }, { rollName, names: quoted(list), lastStrip });
  await openApp(page);
});

When(/^the photographer re-picks the folder "(.+?)" with (.+)$/, async ({ page }, folder, list) => {
  await loadRoll(page, quoted(list).map((name) => ({ name, rel: `${folder}/${name}` })), folder);
});

Then(/^the roll is back with real pixels$/, async ({ page }) => {
  const st = await page.evaluate(() => ({
    remembered: window.__darkroom.state.photos.some((p) => p.remembered),
    bannerHidden: document.querySelector('#rememberBanner').hidden,
  }));
  expect(st.remembered).toBe(false);
  expect(st.bannerHidden).toBe(true);
});

Then(/^"(.+?)" is still picked$/, async ({ page }, name) => {
  const picked = await page.evaluate((n) => {
    const st = window.__darkroom.state;
    const i = st.photos.findIndex((p) => p.name === n);
    return i >= 0 && st.picks.includes(i);
  }, name);
  expect(picked).toBe(true);
});

When(/^the photographer develops the whole roll as strips$/, async ({ page }) => {
  results.downloads = [];
  await page.selectOption('select[data-k="mode"]', 'strip');
  const dl = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.develop(false));
  results.downloads.push(await dl);
});

Then(/^the strips are named (.+)$/, async ({}, list) => {
  const buf = readFileSync(await results.downloads[0].path());
  const names = zipEntries(buf).map((e) => e.name);
  expect(names.sort()).toEqual(quoted(list).sort());
});

// ---------- missing-file flags (PS-21) ----------

Then(/^"(.+?)" stays listed with the roll$/, async ({ page }, name) => {
  const listed = await page.evaluate((n) => window.__darkroom.state.photos.some((p) => p.name === n), name);
  expect(listed).toBe(true);
});

Then(/^"(.+?)" is flagged as missing from the folder$/, async ({ page }, name) => {
  const st = await page.evaluate((n) => {
    const p = window.__darkroom.state.photos.find((q) => q.name === n);
    return p ? { missing: !!p.missing } : null;
  }, name);
  expect(st).not.toBeNull();
  expect(st.missing).toBe(true);
  const item = page.locator('.roll-item.missing', { hasText: name });
  await expect(item).toHaveCount(1);
  expect(await item.getAttribute('title')).toBe('missing from folder');
});

Then(/^"(.+?)" is not picked$/, async ({ page }, name) => {
  const picked = await page.evaluate((n) => {
    const st = window.__darkroom.state;
    const i = st.photos.findIndex((p) => p.name === n);
    return i >= 0 && st.picks.includes(i);
  }, name);
  expect(picked).toBe(false);
});

Then('no shot is flagged as missing', async ({ page }) => {
  await expect(page.locator('.roll-item.missing')).toHaveCount(0);
});

Then(/^the remembered roll is now "(.+?)"$/, async ({ page }, name) => {
  const meta = await metaOf(page);
  expect(meta.name).toBe(name);
});
