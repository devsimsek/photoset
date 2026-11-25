// Export format scenarios: formats other than JPG, and the naming law across
// every extension. Format is set on the app state, exactly as the output panel
// does it.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { results } from './results.js';

const { Given, Then } = createBdd();

const FORMATS = { JPG: 'image/jpeg', WebP: 'image/webp', PNG: 'image/png' };

Given(/^the photographer chose (JPG|WebP|PNG) output$/, async ({ page }, kind) => {
  await page.evaluate((f) => { window.__darkroom.state.s.format = f; }, FORMATS[kind]);
});

Then(/^the result "(.+)" downloads as a (WebP|PNG) file$/, async ({}, name, kind) => {
  const download = results.downloads[0];
  expect(download.suggestedFilename()).toBe(name);
  const buf = readFileSync(await download.path());
  if (kind === 'WebP') {
    expect(buf.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(buf.subarray(8, 12).toString('latin1')).toBe('WEBP');
  } else {
    expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }
});
