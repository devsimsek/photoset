// Per-shot panel scenarios (PS-61): the panel follows the selection, APPLY TO
// ALL is the roll-wide act, the per-shot reset clears the override, and the
// remembered roll refuses edits with the placeholder toast.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { resultBlobs } from './helpers.js';

const { When, Then } = createBdd();

When('the photographer applies the look to every shot', async ({ page }) => {
  await page.click('#applyAllBtn');
});

When('the photographer resets the look', async ({ page }) => {
  await page.click('#resetLook');
});

Then(/^the (\w+) slider reads (-?\d+)$/, async ({ page }, k, v) => {
  const val = await page.locator(`input[data-k="${k}"]`).inputValue();
  expect(Number(val), `the ${k} slider reads ${val}`).toBe(Number(v));
});

Then('the results are byte-identical', async ({ page }) => {
  const blobs = await resultBlobs(page);
  expect(blobs.length, 'the run produced no results').toBeGreaterThan(1);
  const first = blobs[0].bytes;
  for (let i = 1; i < blobs.length; i++) {
    expect(blobs[i].bytes.length, `${blobs[i].name} differs in size`).toBe(first.length);
    expect(Buffer.from(blobs[i].bytes).equals(Buffer.from(first)), `${blobs[i].name} differs from ${blobs[0].name}`).toBe(true);
  }
});

Then('no shot carries a look override', async ({ page }) => {
  const bad = await page.evaluate(() => Object.entries(window.__darkroom.state.perPhoto)
    .filter(([, o]) => o && (o.look || o.stock))
    .map(([n]) => n));
  expect(bad, `shots still carrying a look override: ${bad.join(', ')}`).toEqual([]);
});

Then('the apply-to-all control sits out with a reason', async ({ page }) => {
  const b = await page.evaluate(() => {
    const el = document.querySelector('#applyAllBtn');
    return el ? { disabled: el.disabled, title: el.title } : null;
  });
  expect(b, 'no apply-to-all control').toBeTruthy();
  expect(b.disabled, 'the apply-to-all control should sit out here').toBe(true);
  expect(b.title || '', 'the apply-to-all control does not say why it sits out').toMatch(/roll|shot/i);
});
