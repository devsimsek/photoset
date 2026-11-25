// Phone layout scenarios (PS-22): 375px-first layout and 44px touch targets.
// Playwright opens a fresh context per scenario, so resizing the page right
// after open gives exactly the phone window the feature asks for.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { openApp } from './helpers.js';

const { Given, Then } = createBdd();

const PHONE = { width: 375, height: 667 };

Given('the darkroom is open on a 375 by 667 phone screen', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize(PHONE);
});

const rect = (page, selector) =>
  page.evaluate((sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, visible: !!(r.width && r.height) };
  }, selector);

Then('the load control, the contact sheet, the develop button and the save control are all on screen',
  async ({ page }) => {
    for (const sel of ['#loadBtn', '.stock', '#developBtn', '#saveOneBtn']) {
      const r = await rect(page, sel);
      expect(r, sel + ' is missing').toBeTruthy();
      expect(r.visible, sel + ' has no size').toBe(true);
      // vertical scroll is fine on a phone; horizontal overflow is not
      expect(r.x, sel + ' starts off the left edge').toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, sel + ' sticks out past the right edge').toBeLessThanOrEqual(PHONE.width + 0.5);
    }
  });

Then('nothing overflows the phone screen horizontally', async ({ page }) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(PHONE.width);
});

Then('the develop button spans at least 44 by 44 points', async ({ page }) => {
  const r = await rect(page, '#developBtn');
  expect(r.width).toBeGreaterThanOrEqual(44);
  expect(r.height).toBeGreaterThanOrEqual(44);
});

Then('the range sliders, the pick circles and the form controls each span at least 44 by 44 points',
  async ({ page }) => {
    // A loaded roll puts pick circles on the sheet; the form controls come
    // from the FORMAT and OUTPUT sections.
    const sizes = await page.evaluate(() => {
      const box = (n) => {
        const r = n.getBoundingClientRect();
        return { sel: n.tagName.toLowerCase() + (n.dataset.k ? `[data-k=${n.dataset.k}]` : ''), w: r.width, h: r.height };
      };
      const onScreen = (n) => n.checkVisibility({ checkVisibilityCSS: true }); // closed dialogs stay out
      const picks = [...document.querySelectorAll('.ri-pick')].filter(onScreen);
      const ranges = [...document.querySelectorAll('input[type=range]')].filter(onScreen);
      const forms = [...document.querySelectorAll('select, input[type=text], input[type=number]')].filter(onScreen);
      return { picks: picks.map(box), ranges: ranges.map(box), forms: forms.map(box) };
    });
    expect(sizes.ranges.length).toBeGreaterThan(0);
    expect(sizes.forms.length).toBeGreaterThan(0);
    expect(sizes.picks.length).toBeGreaterThan(0); // the roll is loaded, so the sheet has pick circles
    for (const [, list] of Object.entries(sizes)) {
      for (const { sel, w, h } of list) {
        expect(w, sel + ' is narrower than a thumb target').toBeGreaterThanOrEqual(44);
        expect(h, sel + ' is shorter than a thumb target').toBeGreaterThanOrEqual(44);
      }
    }
  });
