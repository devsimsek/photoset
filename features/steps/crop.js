// Free crop scenarios (PS-40). The drag dispatches real PointerEvents on the
// preview canvas with positions computed from its bounding box, so the
// fractions land exactly on quarter points and the develop asserts the exact
// dragged region.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { loadRoll, probeResult, isColour, colourFail } from './helpers.js';

const { Given, When, Then } = createBdd();

Given(/^the photographer loaded a split roll "(.+?)" with "(.+?)"$/, async ({ page }, roll, name) => {
  await loadRoll(page, [{ name, asym: true, rel: `${roll}/${name}` }], roll);
});

// Corner-to-corner half drags: the fractions are exact at these points.
const HALF = {
  left: [[0, 0], [0.5, 1]], right: [[0.5, 0], [1, 1]],
  top: [[0, 0], [1, 0.5]], bottom: [[0, 0.5], [1, 1]],
};

When(/^the photographer drags a crop over the (left|right|top|bottom) half of the preview$/, async ({ page }, half) => {
  await page.evaluate(([a, b]) => {
    const pv = document.querySelector('#preview');
    const r = pv.getBoundingClientRect();
    const drag = (f, type) => pv.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 1,
      clientX: r.left + r.width * f[0], clientY: r.top + r.height * f[1],
    }));
    drag(a, 'pointerdown');
    drag(b, 'pointermove');
    drag(b, 'pointerup');
  }, HALF[half]);
});

When('the photographer enters crop mode', async ({ page }) => {
  await page.click('#cropBtn');
});

When('the photographer resets the crop', async ({ page }) => {
  await page.click('#cropReset');
});

When('the photographer loads a different roll', async ({ page }) => {
  await loadRoll(page, [{ name: 'other.jpg' }], 'other');
});

When(/^the photographer re-picks the split shot "(.+?)" in folder "(.+?)"$/, async ({ page }, name, folder) => {
  await loadRoll(page, [{ name, asym: true, rel: `${folder}/${name}` }], folder);
});

Then('no shot carries a crop', async ({ page }) => {
  const perPhoto = await page.evaluate(() => window.__darkroom.state.perPhoto);
  expect(perPhoto).toEqual({});
});
