// Export format scenarios: formats other than JPG, the size cap, and the
// naming law across every extension. Format, quality and cap are set on the
// app state, exactly as the output panel does it; the panel itself is driven
// through the real controls in the last scenario.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { quoted, loadRoll } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

const FORMATS = { JPG: 'image/jpeg', WebP: 'image/webp', PNG: 'image/png' };

Given(/^the photographer chose (JPG|WebP|PNG) output$/, async ({ page }, kind) => {
  await page.evaluate((f) => { window.__darkroom.state.s.format = f; }, FORMATS[kind]);
});

Given(/^the photographer loaded a busy roll with (.+)$/, async ({ page }, list) => {
  await loadRoll(page, quoted(list).map((name) => ({ name, busy: true })), '');
});

Given(/^the photographer pushes quality to (\d+)$/, async ({ page }, q) => {
  await page.evaluate((v) => { window.__darkroom.state.s.quality = v; }, Number(q));
});

Given(/^the photographer sets the cap to (\d+) KB$/, async ({ page }, kb) => {
  results.capKB = Number(kb);
  await page.evaluate((v) => { window.__darkroom.state.s.capKB = v; }, results.capKB);
});

When(/^the photographer picks (JPG|WebP|PNG), quality (\d+) and a (\d+) KB cap in the output panel$/, async ({ page }, kind, q, kb) => {
  results.capKB = Number(kb);
  await page.locator('input[data-k="quality"]').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, q);
  await page.selectOption('select[data-k="format"]', FORMATS[kind]);
  await page.fill('input[data-k="capKB"]', String(kb));
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

Then('the result downloads within the cap', async () => {
  const buf = readFileSync(await results.downloads[0].path());
  expect(buf.length).toBeLessThanOrEqual(results.capKB * 1024);
});

Then('the result downloads anyway, larger than the cap', async () => {
  const buf = readFileSync(await results.downloads[0].path());
  expect(buf.length).toBeGreaterThan(results.capKB * 1024);
});

Then('the result is a PNG at half the long edge', async () => {
  const download = results.downloads[0];
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
  const buf = readFileSync(await download.path());
  expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  // the busy shot is 256x192; the cap path scales the long edge, so a shipped
  // 50% result decodes at 128x96
  expect(buf.readUInt32BE(16)).toBe(128);
  expect(buf.readUInt32BE(20)).toBe(96);
});

Then('the estimate shows a result within the cap', async ({ page }) => {
  const capBytes = results.capKB * 1024;
  let last = '';
  await expect.poll(async () => {
    last = await page.locator('#estOne').textContent();
    const m = last.match(/→\s*(\d+) (B|KB)/);
    return m ? Number(m[1]) * (m[2] === 'KB' ? 1024 : 1) : Infinity;
  }, { timeout: 15000, message: `estimate never went under the cap: ${last}` }).toBeLessThanOrEqual(capBytes);
});
