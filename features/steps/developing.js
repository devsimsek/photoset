import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();
import { readFileSync } from 'node:fs';
import { quoted, loadRoll, zipEntries, startsWithMagic } from './helpers.js';
import { results } from './results.js';

Given(/^the photographer loaded a roll(?: "(.+?)")? with (.+)$/, async ({ page }, rollName, list) => {
  await loadRoll(page, quoted(list).map((name) => ({ name })), rollName || '');
});

When(/^the photographer develops (the current shot|the whole roll)$/, async ({ page }, which) => {
  results.downloads = [];
  const onlyCurrent = which === 'the current shot';
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate((only) => window.__darkroom.develop(only), onlyCurrent);
  results.downloads.push(await downloadPromise);
});

const COUNT = { one: 1, two: 2, three: 3, four: 4 };

Then(/^one result is produced as a JPEG$/, async () => {
  const download = results.downloads[0];
  expect(download.suggestedFilename()).toMatch(/\.jpe?g$/i);
  const buf = readFileSync(await download.path());
  expect(startsWithMagic(buf, 'jpg')).toBe(true);
});

Then(/^(\w+) results are produced$/, async ({}, word) => {
  const n = COUNT[word];
  const download = results.downloads[0];
  if (n === 1) {
    expect(download.suggestedFilename()).toMatch(/\.jpe?g$/i);
    return;
  }
  const entries = zipEntries(readFileSync(await download.path()));
  expect(entries.length).toBe(n);
});

Then('every result is a developed JPEG', async () => {
  const download = results.downloads[0];
  const buf = readFileSync(await download.path());
  if (download.suggestedFilename().match(/\.jpe?g$/i)) {
    expect(startsWithMagic(buf, 'jpg')).toBe(true);
    return;
  }
  for (const entry of zipEntries(buf)) {
    expect(entry.name).toMatch(/\.jpe?g$/i);
    expect(entry.data.length).toBeGreaterThan(4);
    expect(startsWithMagic(entry.data, 'jpg')).toBe(true);
  }
});
