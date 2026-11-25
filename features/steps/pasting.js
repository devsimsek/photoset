// Paste scenarios (PS-24): real ClipboardEvent dispatches with real image
// bytes built in the page, so the app's paste handling is under test.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();
import { quoted } from './helpers.js';

Given(/^the photographer loaded a folder containing (.+)$/, async ({ page }, list) => {
  const { loadRoll } = await import('./helpers.js');
  await loadRoll(page, quoted(list).map((name) => ({ name })), '');
});

When(/^the photographer pastes a copied (JPEG|PNG|GIF) named "(.+?)"$/, async ({ page }, kind, name) => {
  await page.evaluate(async ({ kind, name }) => {
    let blob, type;
    if (kind === 'JPEG' || kind === 'PNG') {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      c.getContext('2d').fillStyle = '#356b8a';
      c.getContext('2d').fillRect(0, 0, c.width, c.height);
      type = kind === 'JPEG' ? 'image/jpeg' : 'image/png';
      blob = await new Promise((r) => c.toBlob(r, type, 0.9));
    } else {
      // GIF89a header bytes; the app decides by the item's MIME type.
      type = 'image/gif';
      blob = new Blob([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00])], { type });
    }
    const file = new File([blob], name, { type });
    const dt = new DataTransfer();
    dt.items.add(file);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { kind, name });
  // give async paste handling (PNG canvas re-encode, roll rebuild) a beat
  await page.waitForTimeout(300);
});

Then(/^the paste refuses with a toast naming "(.+?)"$/, async ({ page }, fmt) => {
  await expect.poll(
    () => page.evaluate(() => document.querySelector('#toastMsg').textContent),
    { timeout: 5000, message: `no refusal toast naming ${fmt} appeared` },
  ).toContain(fmt);
});

Then(/^"(.+?)" is a real JPEG the roll can decode$/, async ({ page }, name) => {
  const ok = await page.evaluate(async (n) => {
    try {
      const data = await window.api.readFile(n);
      const bmp = await createImageBitmap(new Blob([data], { type: 'image/jpeg' }));
      const size = [bmp.width, bmp.height];
      bmp.close();
      return size;
    } catch {
      return null;
    }
  }, name);
  expect(ok, name + ' does not decode as a JPEG').not.toBeNull();
});

Then(/^the roll is "(.+?)" and lists (.+)$/, async ({ page }, rollName, list) => {
  const st = await page.evaluate(() => ({
    name: window.__darkroom.state.roll && window.__darkroom.state.roll.name,
    photos: window.__darkroom.state.photos.map((p) => p.name),
  }));
  expect(st.name).toBe(rollName);
  expect(st.photos).toEqual(quoted(list));
});
