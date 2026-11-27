// Film-shaped colour scenarios (PS-52): the S-curve contrast, the halation
// look key and the layered grain. Probes sample the developed PNG losslessly;
// the halation films are built in the step from the neutral look.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { loadRoll, probeResult } from './helpers.js';
import { neutralLook } from './lut.js';

const { Given, When, Then } = createBdd();

Given('the photographer loaded a shot with a bright disk on dark ground', async ({ page }) => {
  await loadRoll(page, [{ name: 'disk.jpg', disk: true }], '');
});

// The disk sits at 40% of the width with a 36 px radius on a 160x120 frame:
// the rim probe sits in the glow band just outside its edge, the corner probe
// is far top-right where the glow must not reach.
const RIM = [0.64, 0.5, 2];
const CORNER = [0.93, 0.08, 2];

function halationFilm(name, halation) {
  const look = { ...neutralLook() };
  if (halation != null) look.halation = halation;
  return {
    schema: 1,
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    iso: '45',
    look,
  };
}

async function importFilmFile(page, film) {
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify(film));
  await page.click('#filmOk');
  const applied = await page.evaluate((id) => window.__darkroom.state.stock === id, film.id);
  expect(applied, `the film ${film.name} was refused`).toBe(true);
}

Given(/^the photographer imported the film "(.+?)" with halation (\d+) as a file$/, async ({ page }, name, amt) => {
  await importFilmFile(page, halationFilm(name, Number(amt)));
});

When(/^the photographer imports the film "(.+?)" with halation (\d+) as a file$/, async ({ page }, name, amt) => {
  await importFilmFile(page, halationFilm(name, Number(amt)));
});

Given('the photographer imported the film "No Halo" without halation as a file', async ({ page }) => {
  await importFilmFile(page, halationFilm('No Halo', null));
});

Then(/^the developed pixel reads (\d+) to (\d+) on every channel$/, async ({ page }, lo, hi) => {
  const probe = await probeResult(page, [[0.5, 0.5]]);
  for (const v of probe.spots[0]) {
    expect(v, `channel ${Math.round(v)} outside ${lo}..${hi}`).toBeGreaterThanOrEqual(Number(lo));
    expect(v, `channel ${Math.round(v)} outside ${lo}..${hi}`).toBeLessThanOrEqual(Number(hi));
  }
});

Then('the rim of the disk glows red-orange', async ({ page }) => {
  const [rim, corner] = (await probeResult(page, [RIM, CORNER])).spots;
  expect(rim[0], `rim red ${Math.round(rim[0])} is no glow`).toBeGreaterThanOrEqual(40);
  expect(rim[0], `rim red ${Math.round(rim[0])} is not red-dominant`).toBeGreaterThan(rim[1] * 1.25);
  expect(rim[1], `rim green ${Math.round(rim[1])} is not above blue`).toBeGreaterThan(rim[2]);
  expect(corner[0], `corner red ${Math.round(corner[0])} caught the glow`).toBeLessThan(24);
});

Then('the developed rim stays untouched', async ({ page }) => {
  const [rim] = (await probeResult(page, [RIM])).spots;
  expect(rim[0], `rim red ${Math.round(rim[0])} without halation`).toBeLessThan(20);
});

Then('the dark corner stays dark', async ({ page }) => {
  const [corner] = (await probeResult(page, [CORNER])).spots;
  expect(corner[0], `corner red ${Math.round(corner[0])}`).toBeLessThan(24);
});
