// Contact-sheet scenarios (PS-38): the steps read the printed PDF back in
// Node, the same distrust the PDF writer scenarios apply. The sheet's strips
// and pages are counted from the object dictionaries, and the header text is
// matched inside the (uncompressed) content streams.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

When(/^the photographer prints the contact sheet$/, async ({ page }) => {
  results.downloads = [];
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.printContactSheet());
  results.downloads.push(await downloadPromise);
});

// A roll of incompressible 1600x1200 shots, so the size bound and the
// max-size scenario measure real pixel work, not the tiny 64x48 fixtures.
Given(/^the photographer loaded a busy roll of (\d+) large shots$/, async ({ page }, n) => {
  await openApp(page);
  await page.evaluate(async (count) => {
    const files = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.width = 1600;
      c.height = 1200;
      const x = c.getContext('2d');
      const id = x.createImageData(c.width, c.height);
      let s = (0x9e3779b9 + i * 0x85ebca6b) >>> 0;
      for (let j = 0; j < id.data.length; j += 4) {
        s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0;
        id.data[j] = s & 255;
        id.data[j + 1] = (s >>> 8) & 255;
        id.data[j + 2] = (s >>> 16) & 255;
        id.data[j + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      c.width = c.height = 0;
      files.push(new File([blob], `busy-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
    }
    await window.__darkroom.loadRoll(window.api.fromFiles(files, 'bigroll'));
  }, Number(n));
});

Given(/^the photographer sets max size to (\d+)$/, async ({ page }, v) => {
  await page.selectOption('select[data-k="maxEdge"]', String(v));
});

async function loadSheet() {
  const download = results.downloads[0];
  expect(download, 'the scenario never printed a sheet').toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  return readFileSync(await download.path()).toString('latin1');
}

const countOf = (s, re) => [...s.matchAll(re)].length;

Then(/^the contact sheet carries (\d+) strips? on (\d+) pages?$/, async ({}, strips, pages) => {
  const s = await loadSheet();
  expect(countOf(s, /\/Subtype \/Image\b/g)).toBe(Number(strips));
  expect(countOf(s, /\/Type \/Page(?!s)/g)).toBe(Number(pages));
});

Then('the sheet names the film, the roll and the print date as text', async () => {
  const s = await loadSheet();
  // The default stock is Clean Scan and the unnamed test roll is "photos".
  expect(s).toContain('(Clean Scan)');
  expect(s).toContain('(Roll photos -');
  expect(s).toMatch(/printed \d{4}-\d{2}-\d{2}/);
});

Then('the contact sheet stays under 8 MB', async () => {
  const download = results.downloads[0];
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const buf = readFileSync(await download.path());
  expect(buf.length).toBeLessThan(8 * 1024 * 1024);
  expect(buf.length).toBeGreaterThan(0);
});

Then(/^the embedded strip image is (\d+)x(\d+) pixels$/, async ({}, w, h) => {
  const s = await loadSheet();
  expect(s).toContain(`/Subtype /Image /Width ${w} /Height ${h}`);
});
