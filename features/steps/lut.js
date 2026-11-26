// LUT scenarios (PS-45/46/47/48): schema v2 films, .cube import and export,
// and the engine's trilinear pass. Fixtures are constructed in these steps
// from small known tables, never committed.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRoll, quoted } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

// ---------- fixtures built in the step, not committed ----------

// The look fields a valid film requires, all at their neutral defaults.
export function neutralLook() {
  return {
    exposure: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, fade: 0,
    split: 0, shadow: '#2f6a72', highlight: '#ffb46a',
    grain: 0, grainSize: 1.5, vignette: 0, softness: 0, leak: 0, flicker: 0,
    aspect: 'orig', frame: 'none', date: false, dateFmt: 'ymd', rotate: 0,
  };
}

// Base64 of a size^3 identity table, 8-bit, red fastest: the byte at lattice
// point (b, g, r) is round(r * 255 / (size - 1)) per channel.
export function identityTableB64(size) {
  const bytes = new Uint8Array(size * size * size * 3);
  let k = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        bytes[k++] = Math.round((r * 255) / (size - 1));
        bytes[k++] = Math.round((g * 255) / (size - 1));
        bytes[k++] = Math.round((b * 255) / (size - 1));
      }
    }
  }
  return Buffer.from(bytes).toString('base64');
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'film';

export function lutFilm(name, size, table) {
  return { schema: 2, id: slug(name), name, iso: 'LUT', look: neutralLook(), lut: { name, size, table } };
}

// ---------- import helpers ----------

async function importFilmJson(page, film) {
  const file = `.tmp/${film.id || 'film'}.json`;
  writeFileSync(file, JSON.stringify(film));
  await page.click('#importFilmBtn');
  await page.setInputFiles('#filmFile', file);
  await page.click('#filmOk');
}

Given(/^the photographer imported the LUT film "(.+?)" with a (\d+)-point identity table as a file$/,
  async ({ page }, name, size) => {
    await importFilmJson(page, lutFilm(name, Number(size), identityTableB64(Number(size))));
  });

When(/^the photographer imports the LUT film "(.+?)" with a (\d+)-point identity table as a file$/,
  async ({ page }, name, size) => {
    await importFilmJson(page, lutFilm(name, Number(size), identityTableB64(Number(size))));
  });

When(/^the photographer imports a LUT film whose table size is (\d+) as a file$/, async ({ page }, size) => {
  // A full-size table for the declared size, so only the range can refuse.
  const n = Number(size);
  const bytes = new Uint8Array(n * n * n * 3);
  await importFilmJson(page, lutFilm('Broken', n, Buffer.from(bytes).toString('base64')));
});

When('the photographer imports a LUT film with a truncated table as a file', async ({ page }) => {
  const full = identityTableB64(17);
  await importFilmJson(page, lutFilm('Broken', 17, full.slice(0, full.length - 700)));
});

When(/^the photographer pastes a LUT film with a (\d+)-point identity table$/, async ({ page }, size) => {
  const s = await page.evaluate(() => {
    const st = window.__darkroom.state.s;
    return { exposure: st.exposure, contrast: st.contrast };
  });
  results.film.before = s;
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify(lutFilm('Cuba 17', Number(size), identityTableB64(Number(size)))));
  await page.click('#filmOk');
});

When('the photographer pastes a film with schema 2 and no lut', async ({ page }) => {
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify({
    schema: 2, id: 'look-only', name: 'Look Only', iso: '64', look: neutralLook(),
  }));
  await page.click('#filmOk');
});

When('the photographer opens the film dialog of the active LUT film', async ({ page }) => {
  await page.click('#saveFilmBtn');
});

// ---------- refusals ----------

Then(/^the import refuses naming the LUT size range$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast about the LUT size range appeared' },
  ).toMatch(/out of range \(17 to 65\)/);
});

Then(/^the import refuses with a message naming the expected table length$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast naming the table length appeared' },
  ).toMatch(/14739 bytes/);
});

Then(/^the QR is refused with a message about the LUT sharing cap$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast about the QR cap appeared' },
  ).toMatch(/too heavy for QR/);
  expect(await page.evaluate(() => document.querySelector('#filmQr').hidden)).toBe(true);
});

Then(/^the import refuses with a message naming the paste cap$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast about the paste cap appeared' },
  ).toMatch(/too heavy to paste/);
});

// ---------- assertions ----------

Then(/^the imported film is schema 2 named "(.+?)"$/, async ({ page }, name) => {
  const film = await page.evaluate(() => {
    const films = JSON.parse(localStorage.getItem('darkroom.films') || '[]');
    return films.find((f) => f.id === window.__darkroom.state.stock) || null;
  });
  expect(film, 'the imported film is not active').toBeTruthy();
  expect(film.schema).toBe(2);
  expect(film.name).toBe(name);
  expect(film.lut).toBeTruthy();
});

Then(/^the downloaded film carries the same (\d+)-point identity table$/, async ({}, size) => {
  const film = JSON.parse(readFileSync(await results.film.download.path(), 'utf8'));
  expect(film.schema).toBe(2);
  expect(film.lut.size).toBe(Number(size));
  expect(film.lut.table).toBe(identityTableB64(Number(size)));
});

Then(/^the persisted film "(.+?)" holds the (\d+)-point identity table$/, async ({ page }, id, size) => {
  const films = await page.evaluate(() => JSON.parse(localStorage.getItem('darkroom.films') || '[]'));
  const film = films.find((f) => f.id === id);
  expect(film, `no persisted film "${id}"`).toBeTruthy();
  expect(film.lut.table).toBe(identityTableB64(Number(size)));
});
