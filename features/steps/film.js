// Film studio scenarios: export, import and validation of schema v1 films.
// Everything runs through the real surfaces: the film dialog, the export
// button's download, and window.__darkroom for state reads.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

// Moves a look slider through the real control, exactly as a drag would.
export async function slideTo(page, k, v) {
  await page.locator(`input[data-k="${k}"]`).evaluate((el, val) => {
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}

const LOOK_FIELDS = [
  'exposure', 'contrast', 'saturation', 'warmth', 'tint', 'fade', 'split',
  'shadow', 'highlight', 'grain', 'grainSize', 'vignette', 'softness',
  'leak', 'flicker', 'aspect', 'frame', 'date', 'dateFmt',
];

async function pasteFilm(page, film) {
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify(film));
  await page.click('#filmOk');
}

Given(/^the photographer chose the "(.+?)" stock and pushed the (\w+) slider to (-?\d+)$/,
  async ({ page }, stock, k, v) => {
    await page.evaluate((id) => window.__darkroom.applyStock(id), stock);
    await slideTo(page, k, Number(v));
  });

When('the photographer exports the film', async ({ page }) => {
  const dl = page.waitForEvent('download');
  await page.click('#exportFilmBtn');
  results.film.download = await dl;
});

When(/^the photographer imports the film file "(.+)"$/, async ({ page }, fixture) => {
  const film = await page.evaluate(() => {
    const f = window.__darkroom.exportFilm();
    f.id = 'koda-test';
    f.name = 'Koda Test';
    f.iso = '64';
    f.look.exposure = 25;
    return f;
  });
  const file = `.tmp/${fixture}`;
  writeFileSync(file, JSON.stringify(film));
  await page.click('#importFilmBtn');
  await page.setInputFiles('#filmFile', file);
  await page.click('#filmOk');
});

When(/^the photographer pastes a film with schema (\d+)$/, async ({ page }, n) => {
  await stashLook(page);
  const film = await page.evaluate(() => window.__darkroom.exportFilm());
  film.schema = Number(n);
  await pasteFilm(page, film);
});

When(/^the photographer pastes a film with exposure (\d+)$/, async ({ page }, v) => {
  await stashLook(page);
  const film = await page.evaluate(() => window.__darkroom.exportFilm());
  film.look.exposure = Number(v);
  await pasteFilm(page, film);
});

When(/^the photographer pastes a film with a shadow colour of "(.+)"$/, async ({ page }, colour) => {
  await stashLook(page);
  const film = await page.evaluate(() => window.__darkroom.exportFilm());
  film.look.shadow = colour;
  await pasteFilm(page, film);
});

async function stashLook(page) {
  results.film.before = await page.evaluate(() => {
    const s = window.__darkroom.state.s;
    return { exposure: s.exposure, contrast: s.contrast };
  });
}

const REFUSAL = { 'the schema version': /schema/i, 'the range': /out of range/i, 'the colour': /colou?r/i };

Then(/^the import refuses with a message about (.+)$/, async ({ page }, topic) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: `no refusal toast about ${topic} appeared` },
  ).toMatch(REFUSAL[topic]);
});

Then('the download is a schema v1 film named for the active stock', async () => {
  const download = results.film.download;
  const film = JSON.parse(readFileSync(await download.path(), 'utf8'));
  results.film.json = film;
  expect(download.suggestedFilename()).toBe(`${film.id}.json`);
  expect(film.schema).toBe(1);
  expect(typeof film.id).toBe('string');
  expect(film.id.length).toBeGreaterThan(0);
  expect(film.name).toBe('Drugstore Disposable');
  expect(typeof film.iso).toBe('string');
  expect(Object.keys(film.look)).toEqual(LOOK_FIELDS);
  expect(film.look.exposure).toBe(35); // the pushed slider
  expect(film.look.warmth).toBe(14);   // the stock's own value came along
  expect(film.look.aspect).toBe('orig');
  expect(film.look.frame).toBe('none');
});

Then('re-importing that film re-applies the exact look', async ({ page }) => {
  const film = results.film.json;
  await page.evaluate(() => window.__darkroom.applyStock('natural'));
  expect(await page.evaluate(() => window.__darkroom.state.s.exposure)).toBe(0);
  await pasteFilm(page, film);
  const s = await page.evaluate(() => window.__darkroom.state.s);
  for (const k of LOOK_FIELDS) expect(s[k]).toBe(film.look[k]);
  expect(await page.evaluate(() => window.__darkroom.state.stock)).toBe(film.id);
});

Then('the imported look applies with exposure 25', async ({ page }) => {
  const s = await page.evaluate(() => window.__darkroom.state.s);
  expect(s.exposure).toBe(25);
  expect(await page.evaluate(() => window.__darkroom.state.stock)).toBe('koda-test');
});

Then('the darkroom look is unchanged', async ({ page }) => {
  const s = await page.evaluate(() => window.__darkroom.state.s);
  expect(s.exposure).toBe(results.film.before.exposure);
  expect(s.contrast).toBe(results.film.before.contrast);
});
