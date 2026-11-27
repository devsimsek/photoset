// LUT scenarios (PS-45/46/47/48): schema v2 films, .cube import and export,
// and the engine's trilinear pass. Fixtures are constructed in these steps
// from small known tables, never committed.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadRoll, quoted, probeResult } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

// ---------- .cube fixtures built in the step, not committed ----------

// Rows in red-fastest order: the red index changes most rapidly.
function cubeRows(size, per) {
  const lines = [];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const out = per(r / (size - 1), g / (size - 1), b / (size - 1));
        lines.push(`${out[0].toFixed(6)} ${out[1].toFixed(6)} ${out[2].toFixed(6)}`);
      }
    }
  }
  return lines;
}

// A deterministic, self-describing .cube text per kind.
function cubeText(kind, title) {
  const L = [];
  if (title) L.push(`TITLE "${title}"`);
  if (kind === 'identity' || kind === 'blue lift' || kind === 'log-domain') {
    L.push('LUT_3D_SIZE 17', 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0');
    const per = kind === 'blue lift' ? (r, g, b) => [r, g, Math.min(1, b + 0.25)] : (r, g, b) => [r, g, b];
    L.push(...cubeRows(17, per));
    if (kind === 'log-domain') L.splice(1, 1, 'DOMAIN_MIN 0.1 0.0 0.0');
  } else if (kind === 'identity-33') {
    L.push('TITLE "Identity 33"', 'LUT_3D_SIZE 33');
    L.push(...cubeRows(33, (r, g, b) => [r, g, b]));
  } else if (kind === '1d') {
    L.push('LUT_1D_SIZE 32');
    L.push(...cubeRows(1, (r, g, b) => [r, g, b]).slice(0, 0)); // no 3D rows
    for (let i = 0; i < 32; i++) {
      const v = i / 31;
      L.push(`${v.toFixed(6)} ${v.toFixed(6)} ${v.toFixed(6)}`);
    }
  } else if (kind === 'size-16' || kind === 'size-66') {
    const n = kind === 'size-16' ? 16 : 66;
    L.push(`LUT_3D_SIZE ${n}`);
    L.push(...cubeRows(n, (r, g, b) => [r, g, b]).slice(0, 512)); // truncated: the size refuses first
  } else if (kind === 'short') {
    L.push('LUT_3D_SIZE 17');
    L.push(...cubeRows(17, (r, g, b) => [r, g, b]).slice(0, 4912)); // one row missing
  } else if (kind === 'nan') {
    L.push('LUT_3D_SIZE 17');
    const rows = cubeRows(17, (r, g, b) => [r, g, b]);
    rows[11] = 'nan 0.0 0.0';
    L.push(...rows);
  }
  return L.join('\n') + '\n';
}

When(/^the photographer imports the generated "(.+?)" cube(?: titled "(.+?)")?$/, async ({ page }, kind, title) => {
  const file = '.tmp/generated.cube';
  writeFileSync(file, cubeText(kind, title));
  await page.click('#importFilmBtn');
  await page.setInputFiles('#filmFile', file);
  await page.click('#filmOk');
});

Then(/^the import refuses naming the 1D cut$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast naming the 1D cut appeared' },
  ).toMatch(/1D/);
});

Then(/^the import refuses naming the non-default domain$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast naming the non-default domain appeared' },
  ).toMatch(/DOMAIN/);
});

Then(/^the import refuses naming the expected and found row counts$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast naming the row counts appeared' },
  ).toMatch(/4913/);
});

Then(/^the import refuses naming the non-finite value$/, async ({ page }) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: 'no refusal toast naming the non-finite value appeared' },
  ).toMatch(/non-finite/);
});

// ---------- export bake fixtures (PS-46) ----------

// A busy shot: high-detail incompressible pixels, so the fidelity compare
// exercises thousands of distinct input values, not one flat colour.
Given('the photographer loaded a busy shot', async ({ page }) => {
  await loadRoll(page, [{ name: 'busy.jpg', busy: true }], '');
});

Given(/^the photographer imported a grade-only film with warmth (\d+) and tint (-?\d+) as "(.+?)"$/,
  async ({ page }, warmth, tint, name) => {
    const film = {
      schema: 1, id: slug(name), name, iso: '64',
      look: { ...neutralLook(), warmth: Number(warmth), tint: Number(tint) },
    };
    await page.click('#importFilmBtn');
    await page.fill('#filmJson', JSON.stringify(film));
    await page.click('#filmOk');
  });

Given(/^the photographer imported a grade-only film with saturation (-?\d+), warmth (\d+), tint (-?\d+), fade (\d+) and split (\d+) as "(.+?)"$/,
  async ({ page }, saturation, warmth, tint, fade, split, name) => {
    const film = {
      schema: 1, id: slug(name), name, iso: '64',
      look: { ...neutralLook(), saturation: Number(saturation), warmth: Number(warmth), tint: Number(tint), fade: Number(fade), split: Number(split) },
    };
    await page.click('#importFilmBtn');
    await page.fill('#filmJson', JSON.stringify(film));
    await page.click('#filmOk');
  });

Given(/^the photographer imported a film with exposure (-?\d+) and a (\d+)-point blue-lift LUT named "(.+?)" as a file$/,
  async ({ page }, exposure, size, name) => {
    const table = tintTableB64(Number(size), (r, g, b) => [r, g, Math.min(1, b + 0.25)]);
    const film = { ...lutFilm(name, Number(size), table), look: { ...neutralLook(), exposure: Number(exposure) } };
    await importFilmJson(page, film);
  });

When('the photographer exports the film as a cube', async ({ page }) => {
  const dl = page.waitForEvent('download');
  await page.click('#exportCubeBtn');
  results.film.cubeDownload = await dl;
});

When('the photographer imports the exported cube file', async ({ page }) => {
  await page.click('#importFilmBtn');
  await page.setInputFiles('#filmFile', await results.film.cubeDownload.path());
  await page.click('#filmOk');
});

// PNG output decodes losslessly, so a full-image channel compare is exact.
async function decodeResultPixels(page) {
  const bytes = readFileSync(await results.downloads[0].path());
  return page.evaluate(async (buf) => {
    const bmp = await createImageBitmap(new Blob([buf], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d');
    x.drawImage(bmp, 0, 0);
    bmp.close();
    return { w: c.width, h: c.height, data: x.getImageData(0, 0, c.width, c.height).data };
  }, new Uint8Array(bytes));
}

Then('the developed pixels are remembered', async ({ page }) => {
  results.film.pixels = await decodeResultPixels(page);
});

Then(/^the developed pixels stay within (\d+)\/255 of the remembered develop$/, async ({ page }, tol) => {
  const now = await decodeResultPixels(page);
  const was = results.film.pixels;
  expect(was, 'no remembered pixels').toBeTruthy();
  expect(now.w).toBe(was.w);
  expect(now.h).toBe(was.h);
  let worst = 0;
  const a = was.data, b = now.data;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] - b[i + c]);
      if (d > worst) worst = d;
    }
  }
  results.film.worstDelta = worst;
  expect(worst, `worst channel delta ${worst}/255`).toBeLessThanOrEqual(Number(tol));
});

Then(/^the cube text names "(.+?)" and declares the 0 to 1 domain$/, async ({}, name) => {
  const text = readFileSync(await results.film.cubeDownload.path(), 'utf8');
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  results.film.cubeRows = lines;
  expect(lines[0]).toBe(`TITLE "${name}"`);
  expect(lines.filter((l) => /^DOMAIN_MIN /.test(l)).length).toBe(1);
  expect(lines.filter((l) => /^DOMAIN_MAX /.test(l)).length).toBe(1);
  expect(lines.find((l) => /^DOMAIN_MIN /.test(l))).toBe('DOMAIN_MIN 0.0 0.0 0.0');
  expect(lines.find((l) => /^DOMAIN_MAX /.test(l))).toBe('DOMAIN_MAX 1.0 1.0 1.0');
});

Then(/^the cube carries (\d+) rows with red changing on every row$/, async ({}, want) => {
  const lines = results.film.cubeRows;
  expect(lines.find((l) => /^LUT_3D_SIZE /.test(l))).toBe('LUT_3D_SIZE 33');
  const rows = lines.filter((l) => /^[0-9.-]/.test(l));
  expect(rows.length).toBe(Number(want));
  // Red-fastest: inside the first green/blue plane the red component of the
  // row value changes on every row.
  let prev = -1;
  for (let i = 0; i < 32; i++) {
    const v = Number(rows[i].split(/\s+/)[0]);
    expect(v, `row ${i + 1} red component`).toBeGreaterThan(prev);
    prev = v;
  }
});

// ---------- engine-pass fixtures ----------

// A shot the develop pipeline sees as one flat colour.
Given(/^the photographer loaded a shot filled "(.+?)"$/, async ({ page }, tone) => {
  await loadRoll(page, [{ name: 'tone.jpg', tone }], '');
});

Given('the photographer outputs PNG files', async ({ page }) => {
  await page.selectOption('select[data-k="format"]', 'image/png');
});

Given(/^the photographer imported the LUT film "(.+?)" that adds ([\d.]+) to blue as a file$/, async ({ page }, name, lift) => {
  const add = Number(lift);
  const table = tintTableB64(17, (r, g, b) => [r, g, Math.min(1, b + add)]);
  await importFilmJson(page, lutFilm(name, 17, table));
});

Given(/^the photographer imported a film with exposure (-?\d+) and contrast (-?\d+) plus a (\d+)-point identity LUT as a file$/,
  async ({ page }, exposure, contrast, size) => {
    const look = { ...neutralLook(), exposure: Number(exposure), contrast: Number(contrast) };
    const film = { schema: 2, id: 'graded-lut', name: 'Graded LUT', iso: '64', look, lut: { name: 'Graded LUT', size: Number(size), table: identityTableB64(Number(size)) } };
    await importFilmJson(page, film);
  });

When('the photographer pastes the same look without the LUT', async ({ page }) => {
  const look = await page.evaluate(() => {
    const films = JSON.parse(localStorage.getItem('darkroom.films') || '[]');
    const f = films.find((x) => x.id === 'graded-lut');
    return { exposure: f.look.exposure, contrast: f.look.contrast };
  });
  const film = { schema: 1, id: 'graded-only', name: 'Graded Only', iso: '64', look: { ...neutralLook(), ...look } };
  await page.click('#importFilmBtn');
  await page.fill('#filmJson', JSON.stringify(film));
  await page.click('#filmOk');
});

// Averaged centre probe of the developed output, decoded losslessly when the
// scenario outputs PNG.
Then(/^the developed blue channel reads about (\d+)$/, async ({ page }, want) => {
  const probe = await probeResult(page, [[0.5, 0.5]]);
  const [r, g, b] = probe.spots[0];
  expect(b, `blue channel ${Math.round(b)} vs about ${want}`).toBeGreaterThanOrEqual(Number(want) - 12);
  expect(b, `blue channel ${Math.round(b)} vs about ${want}`).toBeLessThanOrEqual(Number(want) + 12);
});

Then(/^the developed red channel stays near the source$/, async ({ page }) => {
  const probe = await probeResult(page, [[0.5, 0.5]]);
  expect(probe.spots[0][0], 'red channel crept up').toBeLessThan(20);
});

When('the photographer times a 12-megapixel develop with the identity LUT', async ({ page }) => {
  results.film.ms = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 4000; c.height = 3000; // 12 megapixels
    const x = c.getContext('2d');
    x.fillStyle = '#b34d2e';
    x.fillRect(0, 0, c.width, c.height);
    const bytes = new Uint8Array(17 * 17 * 17 * 3);
    let k = 0;
    for (let b = 0; b < 17; b++) for (let g = 0; g < 17; g++) for (let r = 0; r < 17; r++) {
      bytes[k++] = Math.round((r * 255) / 16); bytes[k++] = Math.round((g * 255) / 16); bytes[k++] = Math.round((b * 255) / 16);
    }
    const bin = [];
    for (let i = 0; i < bytes.length; i += 0x8000) bin.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    const look = {
      exposure: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, fade: 0, split: 0,
      shadow: '#2f6a72', highlight: '#ffb46a', grain: 0, grainSize: 1.5, vignette: 0,
      softness: 0, leak: 0, flicker: 0, aspect: 'orig', frame: 'none', date: false,
      dateFmt: 'ymd', rotate: 0,
      lut: { name: 'Identity', size: 17, table: btoa(bin.join('')) },
    };
    const t0 = performance.now();
    Engine.renderLook(c, { name: 'big.jpg' }, look, 0);
    return performance.now() - t0;
  });
});

Then('the develop completes inside the 10 second budget', async () => {
  expect(results.film.ms, `${Math.round(results.film.ms)} ms for a 12 MP develop`).toBeLessThan(10000);
});

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

// Base64 of a size^3 table built by per(lattice r, g, b in 0..1), 8-bit,
// clamp-then-quantise, red fastest.
export function tintTableB64(size, per) {
  const bytes = new Uint8Array(size * size * size * 3);
  let k = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const out = per(r / (size - 1), g / (size - 1), b / (size - 1));
        for (let c = 0; c < 3; c++) bytes[k++] = Math.max(0, Math.min(255, Math.round(out[c] * 255)));
      }
    }
  }
  return Buffer.from(bytes).toString('base64');
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
