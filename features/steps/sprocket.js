// Sprocket-panorama scenarios (PS-42). The hole probes sample inside a hole
// (dark film base) and in the gap between holes (picture noise), positioned
// from the composeStrip sprocket proportions the frame reuses inverted.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { probeResult, isColour } from './helpers.js';

const { When, Then } = createBdd();

When(/^the photographer chose the sprocket frame$/, async ({ page }) => {
  await page.selectOption('#frameSel', 'sprocket');
  // PS-60 re-pin: the frame is a per-shot look key now, so this roll-wide pin
  // applies it to every shot in view (APPLY TO ALL arrives with PS-61).
  await page.evaluate(() => {
    const st = window.__darkroom.state;
    for (let i = 0; i < st.photos.length; i++) window.__darkroom.select(i);
  });
  await page.selectOption('#frameSel', 'sprocket');
});

const HOLES = [
  [0.039, 0.096, 2], [0.072, 0.096, 4],   // top row: hole centre, gap centre
  [0.039, 0.904, 2], [0.072, 0.904, 4],   // bottom row: hole centre, gap centre
];

Then('the hole rows read as film base over the picture', async ({ page }) => {
  const d = await probeResult(page, HOLES);
  for (const i of [0, 2]) {
    expect(isColour('dark', d.spots[i]), `hole at spot ${i} not dark: ${d.spots[i]}`).toBe(true);
  }
});

Then("the picture between the holes stays visible", async ({ page }) => {
  const d = await probeResult(page, HOLES);
  for (const i of [1, 3]) {
    expect(isColour('light', d.spots[i]), `gap at spot ${i} not light: ${d.spots[i]}`).toBe(true);
  }
});

Then("the first result's hole rows read as film base over the picture", async ({ page }) => {
  const d = await probeResult(page, HOLES, 0);
  for (const i of [0, 2]) {
    expect(isColour('dark', d.spots[i]), `hole at spot ${i} not dark: ${d.spots[i]}`).toBe(true);
  }
});
