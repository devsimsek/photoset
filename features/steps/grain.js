// Deterministic develop scenarios (PS-33). The whole output is compared byte
// for byte: the downloads land in the results handoff the develop steps fill.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadRoll, quoted } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

// Two shots with different names and identical pixels: any difference in the
// developed output can only come from the seeded look keyed by the name.
Given(/^the photographer loaded shots (.+) with identical pixels$/, async ({ page }, list) => {
  await loadRoll(page, quoted(list).map((name) => ({ name, same: true })), '');
});

When(/^the photographer develops the current shot again$/, async ({ page }) => {
  results.downloads = [];
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.develop(true));
  results.downloads.push(await downloadPromise);
});

When('the photographer develops the next shot', async ({ page }) => {
  results.downloads = [];
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.select(1));
  await page.evaluate(() => window.__darkroom.develop(true));
  results.downloads.push(await downloadPromise);
});

// The byte-remember/match/differ steps live in film.js, shared with the film
// studio scenarios: results.film.bytes is the same handoff.

Then('the developed bytes differ from the remembered develop', async () => {
  const buf = readFileSync(await results.downloads[0].path());
  expect(buf.equals(results.film.bytes)).toBe(false);
});
