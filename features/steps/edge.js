// Strip edge print scenarios. The label a composeStrip call uses is exposed
// on window.__darkroom.state.lastStripLabel; the engine prints PHOTOSET 400
// when the label is empty, so the Then step substitutes that default.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

When(/^the photographer develops in strip mode(?: with the "(.+?)" stock)?$/, async ({ page }, stock) => {
  if (stock) await page.evaluate((id) => window.__darkroom.applyStock(id), stock);
  await page.selectOption('select[data-k="mode"]', 'strip');
  results.downloads = [];
  const dl = page.waitForEvent('download');
  await page.evaluate(() => window.__darkroom.develop(false));
  results.downloads.push(await dl);
});

Then(/^the strip edge print reads "(.+)"$/, async ({ page }, expected) => {
  const label = await page.evaluate(() => window.__darkroom.state.lastStripLabel || 'PHOTOSET 400');
  expect(label).toBe(expected);
});
