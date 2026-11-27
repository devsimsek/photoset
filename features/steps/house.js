// House film pack scenarios (PS-53): the stocks exist in the list and each
// one applies a measurable signature on a synthetic palette shot. The palette
// develop goes out as PNG so the probes read exact engine values; the checks
// compare against the remembered Clean Scan develop, not absolute colours.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadRoll, probeResult } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

// Band centres of the palette shot: dark gray, mid red, light warm, deep blue.
const BANDS = [[0.125, 0.5, 3], [0.375, 0.5, 3], [0.625, 0.5, 3], [0.875, 0.5, 3]];
const NAMES = ['dark', 'red', 'light', 'blue'];

const HOUSE = [
  'Chrome 100', 'Portrait Silk', 'Velvet Chrome 50', 'Archive Chrome',
  'Seventies Neg', 'Amber Neg', 'Cine Flat 400', 'Micro Mono 100',
];

Then('the stocks list shows the house stocks', async ({ page }) => {
  for (const name of HOUSE) {
    const btn = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('.stock')].find((x) => x.title === n);
      return b ? { custom: b.classList.contains('custom'), id: b.dataset.id } : null;
    }, name);
    expect(btn, `no stock button titled ${name}`).toBeTruthy();
    expect(btn.custom, `${name} must be a built-in stock, not custom`).toBe(false);
  }
});

Given('the photographer loaded a palette shot', async ({ page }) => {
  await loadRoll(page, [{ name: 'palette.jpg', palette: true }], '');
});

When(/^the photographer develops the current shot with the "(.+?)" stock$/, async ({ page }, stock) => {
  await page.evaluate((id) => window.__darkroom.applyStock(id), stock);
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.develop(true));
  results.downloads = [await downloadPromise];
});

Then('the developed palette probes are remembered', async ({ page }) => {
  results.film.baseline = (await probeResult(page, BANDS)).spots;
});

const gap = (p) => p[0] - p[1];
const warmGap = (p) => p[0] - p[2];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

Then(/^the develop differs from Clean Scan with the signature "(.+?)"$/, async ({ page }, sig) => {
  const now = (await probeResult(page, BANDS)).spots;
  const base = results.film.baseline;
  expect(base, 'no remembered baseline probes').toBeTruthy();
  const at = (spots, band) => Object.fromEntries(NAMES.map((n, i) => [n, spots[i]]));
  const S = at(now), B = at(base);
  const chDelta = (a, b) => Math.max(...a.map((v, c) => Math.abs(v - b[c])));
  switch (sig) {
    case 'faithful-slide':
      // A slide's punch: mids spread apart, hues stay put.
      expect(S.light[0], `light band ${Math.round(S.light[0])} vs ${Math.round(B.light[0])}`)
        .toBeGreaterThanOrEqual(B.light[0] + 4);
      expect(S.dark[0], `dark band ${Math.round(S.dark[0])} vs ${Math.round(B.dark[0])}`)
        .toBeLessThanOrEqual(B.dark[0] - 1);
      expect(gap(S.red) - gap(B.red), 'the red band drifted in hue')
        .toBeLessThanOrEqual(15);
      break;
    case 'soft-portrait':
      // Soft: contrast settles, colour thins out.
      expect(S.light[0], `light band ${Math.round(S.light[0])} did not settle`)
        .toBeLessThanOrEqual(B.light[0] - 5);
      expect(gap(S.red), `red gap ${Math.round(gap(S.red))} did not thin`)
        .toBeLessThanOrEqual(gap(B.red) - 10);
      break;
    case 'vivid':
      // Vivid: the red band burns.
      expect(gap(S.red) - gap(B.red), `red gap grew ${Math.round(gap(S.red) - gap(B.red))}`)
        .toBeGreaterThanOrEqual(60);
      break;
    case 'muted-doc':
      // Muted documentary: colour drains away.
      expect(gap(B.red) - gap(S.red), `red gap shrank ${Math.round(gap(B.red) - gap(S.red))}`)
        .toBeGreaterThanOrEqual(25);
      break;
    case 'blue-shadows':
      // Seventies negative: the shadows lean cyan-blue.
      expect((S.dark[2] - S.dark[0]) - (B.dark[2] - B.dark[0]),
        `blue shadow shift ${Math.round((S.dark[2] - S.dark[0]) - (B.dark[2] - B.dark[0]))}`)
        .toBeGreaterThanOrEqual(15);
      break;
    case 'warm-shadows':
      // Amber negative: the shadows lean warm.
      expect((S.dark[0] - S.dark[2]) - (B.dark[0] - B.dark[2]),
        `warm shadow shift ${Math.round((S.dark[0] - S.dark[2]) - (B.dark[0] - B.dark[2]))}`)
        .toBeGreaterThanOrEqual(12);
      break;
    case 'flat-cine':
      // Cinema flat: colour drains and the blacks lift toward the base.
      expect(gap(B.red) - gap(S.red), `red gap shrank ${Math.round(gap(B.red) - gap(S.red))}`)
        .toBeGreaterThanOrEqual(25);
      expect(S.dark[0], `dark band ${Math.round(S.dark[0])} did not lift`)
        .toBeGreaterThanOrEqual(B.dark[0] + 12);
      break;
    case 'red-mono':
      // Fine mono with a red filter's response: reds render light, neutrals stay neutral.
      expect(Math.max(...S.red.slice(1).map((v, c) => Math.abs(v - S.red[0]))),
        `the red band is not neutral: ${S.red.map(Math.round)}`)
        .toBeLessThanOrEqual(6);
      expect(S.red[0] - S.blue.reduce((a, b) => a + b) / 3,
        `red-vs-blue separation ${Math.round(S.red[0] - S.blue.reduce((a, b) => a + b) / 3)}`)
        .toBeGreaterThanOrEqual(25);
      break;
    default:
      throw new Error('unknown signature ' + sig);
  }
});

Then(/^the exported film carries halation (\d+)$/, async ({}, amt) => {
  const film = JSON.parse(readFileSync(await results.film.download.path(), 'utf8'));
  expect(film.schema, 'a halation film shares as schema v1').toBe(1);
  expect(film.look.halation, `exported halation ${film.look.halation}`).toBe(Number(amt));
});
