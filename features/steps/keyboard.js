// Keyboard scenarios (PS-23): real key presses through page.keyboard, so the
// app's own keydown handling is under test, not a synthetic state change.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { results } from './results.js';

const { When, Then } = createBdd();

const KEYS = {
  'the right arrow': 'ArrowRight',
  'the left arrow': 'ArrowLeft',
  'the down arrow': 'ArrowDown',
  'the up arrow': 'ArrowUp',
  j: 'j',
  k: 'k',
  Escape: 'Escape',
};

When(/^the photographer presses (the right arrow|the left arrow|the down arrow|the up arrow|j|k|Escape)$/,
  async ({ page }, key) => {
    await page.keyboard.press(KEYS[key]);
  });

Then(/^the selection is (?:still )?on "(.+?)"$/, async ({ page }, name) => {
  const on = await page.evaluate((n) => {
    const st = window.__darkroom.state;
    const p = st.photos[st.sel];
    return p ? p.name : null;
  }, name);
  expect(on, 'the selected shot in app state').toBe(name);
  await expect(page.locator('.roll-item.sel', { hasText: name })).toHaveCount(1);
});

When('the photographer opens the film dialog and types "j" into the film name', async ({ page }) => {
  await page.click('#saveFilmBtn');
  await page.type('#filmName', 'j');
});

When('the photographer opens the import dialog and types "j" into the film JSON', async ({ page }) => {
  await page.click('#importFilmBtn');
  await page.type('#filmJson', 'j');
});

When('the photographer types "j" into the size cap field', async ({ page }) => {
  await page.type('input[data-k="capKB"]', 'j');
});

When('the photographer opens the film dialog', async ({ page }) => {
  await page.click('#saveFilmBtn');
});

Then('the film dialog is closed', async ({ page }) => {
  await expect(page.locator('#filmDlg')).toBeHidden();
});

When('the photographer presses Enter', async ({ page }) => {
  results.downloads = [];
  const dl = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  results.downloads.push(await dl);
});
