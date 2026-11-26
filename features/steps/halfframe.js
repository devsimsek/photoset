// Half-frame scenarios (PS-41). Pair composition is pinned by dimensions and
// colour probes; the A/B edge print convention is read off
// window.__darkroom.state.lastEdgeNums, the same handoff lastStripLabel uses.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { quoted, loadRoll, probeResult, resultBlobs, isColour, colourFail } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

const TONES = ['#ff0000', '#00ff00', '#0000ff', '#ff0000'];

Given(/^the photographer loaded a two-tone roll with (.+)$/, async ({ page }, list) => {
  await loadRoll(page, quoted(list).map((name, i) => ({ name, tone: TONES[i % TONES.length] })), '');
});

When(/^the photographer chose the halfframe frame$/, async ({ page }) => {
  await page.selectOption('#frameSel', 'halfframe');
});

Then(/^the run produces (one|\d+) results?$/, async ({}, n) => {
  expect(results.downloads.length).toBe(n === 'one' ? 1 : Number(n));
});

Then(/^the half-frame edge print reads "(.+)"$/, async ({ page }, expected) => {
  const nums = await page.evaluate(() => window.__darkroom.state.lastEdgeNums);
  expect(nums[nums.length - 1], 'the half-frame edge print').toBe(expected);
});

Then(/^the last result is (\d+) wide by (\d+) tall$/, async ({ page }, w, h) => {
  const d = await probeResult(page, [], (await resultBlobs(page)).length - 1);
  if (d.w !== Number(w) || d.h !== Number(h)) throw new Error(`the last result is ${d.w}x${d.h}, expected ${w}x${h}`);
});

Then(/^each result is (\d+) wide by (\d+) tall$/, async ({ page }, w, h) => {
  const blobs = await resultBlobs(page);
  for (let i = 0; i < blobs.length; i++) {
    const d = await probeResult(page, [], i);
    if (d.w !== Number(w) || d.h !== Number(h)) throw new Error(`a result is ${d.w}x${d.h}, expected ${w}x${h}`);
  }
});

Then('the result has dark bands above and below the picture', async ({ page }) => {
  // The band spots sit in a gap between sprocket holes, clear of the edge
  // print; the middle spot is inside the picture area.
  const d = await probeResult(page, [[0.259, 0.079, 1], [0.259, 0.9215, 1], [0.5, 0.5, 2]]);
  expect(isColour('dark', d.spots[0]), `top band not dark: ${d.spots[0]}`).toBe(true);
  expect(isColour('dark', d.spots[1]), `bottom band not dark: ${d.spots[1]}`).toBe(true);
  expect(!isColour('dark', d.spots[2]), 'the picture area should not be dark').toBe(true);
});
