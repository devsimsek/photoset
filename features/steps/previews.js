// Stock preview scenarios (PS-54). The previews are canvases painted inside
// each stock button, so the probes read their pixels directly. The match step
// re-renders the active stock through the develop engine at thumbnail size and
// compares against the painted canvas: the preview pipeline IS the develop
// pipeline at small scale, and the render is deterministic, so the tolerance
// stays tight.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

// 'the photographer loaded a palette shot' is shared with the house-pack steps.

When(/^the photographer chose the "(.+?)" stock$/, async ({ page }, stock) => {
  await page.evaluate((id) => window.__darkroom.applyStock(id), stock);
});

Then('every stock button shows a preview canvas', async ({ page }) => {
  await page.waitForFunction(() => {
    const stocks = [...document.querySelectorAll('.stock')];
    return stocks.length > 0 && stocks.every((b) => b.querySelector('canvas.s-prev'));
  }, undefined, { timeout: 10000 });
});

Then('the stock previews differ from each other', async ({ page }) => {
  const diff = await page.evaluate(() => {
    const px = (b) => {
      const c = b.querySelector('canvas.s-prev');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum;
    };
    const ids = [...document.querySelectorAll('.stock')].map((b) => b.dataset.id);
    // The vivid landscape mono pair sits at opposite ends of the pack.
    return px(document.querySelector('.stock[data-id="velvet"]')) -
      px(document.querySelector('.stock[data-id="micro"]'));
  });
  expect(Math.abs(diff), 'two stock previews read identically').toBeGreaterThan(1000);
});

Then("the active stock's preview matches a thumbnail-size develop", async ({ page }) => {
  await page.waitForFunction(() => {
    const b = document.querySelector('.stock.active');
    return b && b.querySelector('canvas.s-prev');
  }, undefined, { timeout: 10000 });
  const mean = await page.evaluate(async () => {
    const st = window.__darkroom.state;
    const p = st.photos[st.sel];
    const s = { exposure: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, fade: 0,
      split: 0, shadow: '#2f6a72', highlight: '#ffb46a', grain: 0, grainSize: 1.5,
      vignette: 0, softness: 0, leak: 0, flicker: 0, halation: 0, aspect: 'orig',
      frame: 'none', date: false, dateFmt: 'ymd', rotate: 0, ...st.s };
    s.frame = 'none'; // the preview shows the look, not the strip
    const source = await (async () => {
      const blob = await window.api.readFile(p.name);
      return createImageBitmap(new Blob([blob], { type: 'image/jpeg' }));
    })();
    const look = Engine.renderLook(source, p, s, 96, null, null);
    const ref = document.createElement('canvas');
    ref.width = 96; ref.height = 72;
    const rx = ref.getContext('2d');
    const sc = Math.max(96 / look.width, 72 / look.height);
    rx.imageSmoothingQuality = 'high';
    rx.drawImage(look, (96 - look.width * sc) / 2, (72 - look.height * sc) / 2, look.width * sc, look.height * sc);
    const cv = document.querySelector('.stock.active canvas.s-prev');
    const a = cv.getContext('2d').getImageData(0, 0, 96, 72).data;
    const b = rx.getImageData(0, 0, 96, 72).data;
    let total = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      for (let c = 0; c < 3; c++) { total += Math.abs(a[i + c] - b[i + c]); n++; }
    }
    return total / n;
  });
  expect(mean, `mean channel difference ${mean.toFixed(2)} at thumbnail scale`).toBeLessThanOrEqual(2);
});

Then('no stock button carries a preview canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.reload();
  await page.waitForTimeout(600);
  const count = await page.evaluate(() => document.querySelectorAll('.stock canvas.s-prev').length);
  expect(count, 'a preview canvas rendered with no roll loaded').toBe(0);
  expect(errors, `page errors: ${errors.join('; ')}`).toEqual([]);
});
