// Rotation scenarios (PS-39). Content orientation is pinned by a deterministic
// pixel probe: the split shot is red on the left and blue on the right, so a
// quarter turn moves the red side to the top and the probe samples patches.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { loadRoll, probeResult, isColour, colourFail } from './helpers.js';

const { Given, When, Then } = createBdd();

Given(/^the photographer loaded a split shot "(.+?)"$/, async ({ page }, name) => {
  await loadRoll(page, [{ name, asym: true }], '');
});

When(/^the photographer sets the rotation to (90|180|270) degrees$/, async ({ page }, deg) => {
  await page.selectOption('select[data-k="rotate"]', deg);
});

When(/^the photographer sets the crop to (.+)$/, async ({ page }, aspect) => {
  await page.selectOption('select[data-k="aspect"]', aspect);
});

Then(/^the result is (\d+) wide by (\d+) tall$/, async ({ page }, w, h) => {
  const d = await probeResult(page, []);
  if (d.w !== Number(w) || d.h !== Number(h)) {
    throw new Error(`the result is ${d.w}x${d.h}, expected ${w}x${h}`);
  }
});

const SPOT = { top: [0.5, 0.25], bottom: [0.5, 0.75], left: [0.25, 0.5], right: [0.75, 0.5] };

Then(/^the result shows (red|blue) at the (top|bottom|left|right) and (red|blue) at the (top|bottom|left|right)$/,
  async ({ page }, c1, w1, c2, w2) => {
    const d = await probeResult(page, [SPOT[w1], SPOT[w2]]);
    expect(isColour(c1, d.spots[0]), colourFail(c1, d.spots[0])).toBe(true);
    expect(isColour(c2, d.spots[1]), colourFail(c2, d.spots[1])).toBe(true);
  });

When(/^the photographer reloads the darkroom with a split shot "(.+?)"$/, async ({ page }, name) => {
  await page.reload();
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
  await loadRoll(page, [{ name, asym: true }], '');
});

Then('the rotation is still 90 degrees', async ({ page }) => {
  const r = await page.evaluate(() => window.__darkroom.state.s.rotate);
  expect(r).toBe(90);
});

// An old schema v1 film: the same JSON the app exported before the rotate key
// existed. It must import and land with the rotation at its default.
When('the photographer pastes a film with no rotate key', async ({ page }) => {
  const film = await page.evaluate(() => window.__darkroom.exportFilm());
  delete film.look.rotate;
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify(film));
  await page.click('#filmOk');
});

Then('the film applies with the rotation at 0', async ({ page }) => {
  const r = await page.evaluate(() => window.__darkroom.state.s.rotate);
  expect(r, 'the imported film should leave the rotation at 0').toBe(0);
});
