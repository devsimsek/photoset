// Keep EXIF scenarios. Output bytes are parsed back in the page with
// Engine.exifDate, the same APP1 walk the app uses to read capture dates.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';
import { results } from './results.js';

const { Given, Then } = createBdd();

Given(/^the photographer loaded a shot "(.+)" taken (\d{4})-(\d{2})-(\d{2})$/, async ({ page }, name, y, m, d) => {
  await openApp(page);
  await page.evaluate(async ({ name, y, m, d }) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#b34d2e';
    x.fillRect(0, 0, c.width, c.height);
    const base = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());

    // a minimal EXIF APP1 carrying DateTimeOriginal, to play the camera
    const dateStr = `${y}:${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')} 10:00:00\0`;
    const t = new Uint8Array(96);
    const v = new DataView(t.buffer);
    t.set([0x49, 0x49], 0); v.setUint16(2, 42, true); v.setUint32(4, 8, true);
    v.setUint16(8, 2, true);
    v.setUint16(10, 0x0132, true); v.setUint16(12, 2, true); v.setUint32(14, 20, true); v.setUint32(18, 56, true);
    v.setUint16(22, 0x8769, true); v.setUint16(24, 4, true); v.setUint32(26, 1, true); v.setUint32(30, 38, true);
    v.setUint32(34, 0, true);
    v.setUint16(38, 1, true);
    v.setUint16(40, 0x9003, true); v.setUint16(42, 2, true); v.setUint32(44, 20, true); v.setUint32(48, 76, true);
    v.setUint32(52, 0, true);
    for (let i = 0; i < 20; i++) { t[56 + i] = dateStr.charCodeAt(i); t[76 + i] = dateStr.charCodeAt(i); }
    const seg = new Uint8Array(4 + 6 + 96);
    const sv = new DataView(seg.buffer);
    sv.setUint16(0, 0xffe1);
    sv.setUint16(2, 104);
    seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
    seg.set(t, 10);
    let at = 2;
    const bv = new DataView(base.buffer);
    if (bv.getUint16(2) === 0xffe0) at = 2 + 2 + bv.getUint16(4);
    const out = new Uint8Array(base.length + seg.length);
    out.set(base.subarray(0, at), 0);
    out.set(seg, at);
    out.set(base.subarray(at), at + seg.length);

    const f = new File([out], name, { type: 'image/jpeg' });
    await window.__darkroom.loadRoll(window.api.fromFiles([f], ''));
  }, { name, y: Number(y), m: Number(m), d: Number(d) });
});

Given('the photographer turns Keep EXIF on', async ({ page }) => {
  await page.evaluate(() => { window.__darkroom.state.s.keepExif = true; });
});

const parsedDate = async (page) => {
  const bytes = [...readFileSync(await results.downloads[0].path())];
  return page.evaluate(async (b) => Engine.exifDate(new Blob([new Uint8Array(b)])), bytes);
};

Then('the result JPG carries no EXIF', async ({ page }) => {
  expect(await parsedDate(page)).toBeNull();
});

Then(/^the result JPG's capture date reads (\d{4})-(\d{2})-(\d{2})$/, async ({ page }, y, m, d) => {
  const date = await parsedDate(page);
  expect(date).not.toBeNull();
  expect(date.getFullYear()).toBe(Number(y));
  expect(date.getMonth() + 1).toBe(Number(m));
  expect(date.getDate()).toBe(Number(d));
});
