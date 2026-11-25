import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { openApp } from './helpers.js';
import { results } from './results.js';

const { When, Then } = createBdd();

// Saves the same file name twice inside one batch, exactly as a develop run
// would: beginBatch opens the batch, writeFile hands over each result.
When(/^the photographer saves two developed files called "(.+)"$/, async ({ page }, name) => {
  await openApp(page);
  results.names = await page.evaluate(async (name) => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    c.getContext('2d').fillRect(0, 0, 32, 32);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const data = new Uint8Array(await blob.arrayBuffer());
    await window.api.beginBatch('developed');
    const first = await window.api.writeFile('developed', name, data);
    const second = await window.api.writeFile('developed', name, data);
    return [first, second];
  }, name);
});

Then(/^the (first|second) file is saved as "(.+)"$/, async ({}, which, expected) => {
  const got = which === 'first' ? results.names[0] : results.names[1];
  expect(got).toBe(expected);
});
