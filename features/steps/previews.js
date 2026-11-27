// The stocks list contract after the PS-54 revert (PS-57): swatches only, no
// preview canvases, with or without a roll loaded. The 'chose the stock' step
// stays here because film-studio and rotation features share it.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

// 'the photographer loaded a palette shot' is shared with the house-pack steps.

When(/^the photographer chose the "(.+?)" stock$/, async ({ page }, stock) => {
  await page.evaluate((id) => window.__darkroom.applyStock(id), stock);
});

Then('no stock button carries a preview canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForFunction(() => !!window.__darkroom && window.__darkroom.state.photos.length > 0, undefined, { timeout: 10000 });
  // The old previews painted lazily on idle callbacks: settle first, so the
  // assertion cannot pass by checking before the paint window.
  await page.waitForTimeout(2000);
  const count = await page.evaluate(() => document.querySelectorAll('.stock canvas.s-prev').length);
  expect(count, 'a stock button renders a preview canvas').toBe(0);
  expect(errors, `page errors: ${errors.join('; ')}`).toEqual([]);
});

Then('every stock button keeps its two-colour swatch', async ({ page }) => {
  const bad = await page.evaluate(() => {
    return [...document.querySelectorAll('.stock')]
      .filter((b) => !b.style.getPropertyValue('--c1') || !b.style.getPropertyValue('--c2'))
      .map((b) => b.dataset.id);
  });
  expect(bad, 'stock buttons missing their swatch colours').toEqual([]);
});
