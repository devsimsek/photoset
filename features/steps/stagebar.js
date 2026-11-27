// Stage bar and first-run hint scenarios (PS-55). The assertions read
// getBoundingClientRect, the way a layout bug actually shows: on one line,
// inside the bar, with the frame info still readable.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { loadRoll } from './helpers.js';

const { Given, When, Then } = createBdd();

const rect = (page, selector) =>
  page.evaluate((sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, hidden: n.hidden };
  }, selector);

When(/^the window is (\d+) wide$/, async ({ page }, w) => {
  await page.setViewportSize({ width: Number(w), height: 900 });
  await page.waitForTimeout(200);
});

When(/^the window is (\d+) wide and crop mode is on$/, async ({ page }, w) => {
  await page.setViewportSize({ width: Number(w), height: 900 });
  await page.waitForTimeout(200);
  await page.click('#cropBtn');
  await page.waitForTimeout(200);
});

Then('prevBtn and nextBtn sit on one line with a bounded gap', async ({ page }) => {
  const [prev, next] = [await rect(page, '#prevBtn'), await rect(page, '#nextBtn')];
  expect(prev, 'the prev button is missing').toBeTruthy();
  expect(next, 'the next button is missing').toBeTruthy();
  const yGap = Math.abs(prev.y + prev.h / 2 - (next.y + next.h / 2));
  expect(yGap, `prev and next sit ${yGap.toFixed(1)} px apart vertically`).toBeLessThanOrEqual(2);
  expect(next.right, 'next sits left of prev').toBeGreaterThanOrEqual(prev.x);
  // Bounded: the nav group always fits the bar, whatever the mode buttons do.
  const bar = await rect(page, '.stage-bar');
  expect(prev.x, 'prev escaped the bar on the left').toBeGreaterThanOrEqual(bar.x - 0.5);
  expect(next.right, 'next escaped the bar on the right').toBeLessThanOrEqual(bar.right + 0.5);
  expect(next.right - prev.x, 'the nav group grew past the bar').toBeLessThanOrEqual(bar.w);
});

Then('every stage bar control stays inside the bar', async ({ page }) => {
  const bar = await rect(page, '.stage-bar');
  for (const sel of ['#compareBtn', '#cropBtn', '#cropReset', '#cropDone']) {
    const r = await rect(page, sel);
    if (!r || r.hidden) continue;
    expect(r.x, `${sel} starts outside the bar`).toBeGreaterThanOrEqual(bar.x - 0.5);
    expect(r.right, `${sel} sticks out past the bar`).toBeLessThanOrEqual(bar.right + 0.5);
  }
});

Then(/^the frame info keeps at least (\d+) px$/, async ({ page }, want) => {
  const info = await rect(page, '#frameInfo');
  expect(info.w, `the frame info crushed to ${Math.round(info.w)} px`).toBeGreaterThanOrEqual(Number(want));
});

Then('the empty state carries the one-line privacy hint', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
  const hint = await rect(page, '#firstHint');
  expect(hint, 'the first-run hint element is missing').toBeTruthy();
  expect(hint.hidden, 'the first-run hint is hidden on a clean storage').toBe(false);
  const text = await page.evaluate(() => document.querySelector('#firstHint').textContent);
  expect(text).toMatch(/everything stays on your device/i);
});

Then('the hint never comes back', async ({ page }) => {
  const flagged = await page.evaluate(() => localStorage.getItem('darkroom.hinted'));
  expect(flagged, 'no hint flag was recorded by the roll load').toBe('1');
  const hint = await rect(page, '#firstHint');
  expect(hint.hidden, 'the hint came back after a roll load').toBe(true);
});

When('the phone is 375 wide and the film dialog is open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.waitForTimeout(200);
  await page.click('#saveFilmBtn');
  await page.waitForFunction(() => {
    const dlg = document.querySelector('#filmDlg');
    return dlg.open && !document.querySelector('#filmQr').hidden;
  }, undefined, { timeout: 5000 });
});

Then('the QR sits beside the copy link with sane spacing', async ({ page }) => {
  const [qr, link] = [await rect(page, '#filmQr'), await rect(page, '#copyLinkBtn')];
  const yGap = Math.abs(qr.y + qr.h / 2 - (link.y + link.h / 2));
  expect(yGap, `the QR and the link sit ${yGap.toFixed(1)} px apart vertically`).toBeLessThanOrEqual(16);
  expect(qr.right, 'the QR overlaps the link').toBeLessThanOrEqual(link.x + 1);
  const dlg = await rect(page, '#filmDlg');
  expect(qr.x, 'the QR escapes the dialog').toBeGreaterThanOrEqual(dlg.x);
  expect(link.right, 'the link escapes the dialog').toBeLessThanOrEqual(dlg.right);
});

Then('the dialog rows align', async ({ page }) => {
  const xs = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('#filmDlg .dlg-field')]
      .filter((n) => n.offsetParent)
      .map((n) => Math.round(n.getBoundingClientRect().x));
    const controls = [...document.querySelectorAll('#filmDlg .dlg-field input, #filmDlg .dlg-field textarea')]
      .filter((n) => n.offsetParent)
      .map((n) => Math.round(n.getBoundingClientRect().x));
    return { labels: [...new Set(labels)], controls: [...new Set(controls)] };
  });
  expect(xs.labels.length, `the field labels sit at ${xs.labels} x`).toBe(1);
  expect(xs.controls.length, `the field controls sit at ${xs.controls} x`).toBe(1);
});
