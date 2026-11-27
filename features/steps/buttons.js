import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

const ACTION = ['#developBtn', '#saveOneBtn', '#printBtn', '#compareBtn', '#cropBtn'];
let states = null;

async function buttonStates(page) {
  return page.evaluate((ids) => ids.map((id) => {
    const b = document.querySelector(id);
    return { id, disabled: b ? b.disabled : null, title: b ? b.title : null };
  }), ACTION);
}

function assertAll(state, disabled) {
  for (const s of state) {
    if (disabled && !s.disabled) throw new Error(`${s.id} is enabled on an empty darkroom (title: ${s.title})`);
    if (!disabled && s.disabled) throw new Error(`${s.id} is still disabled after a roll loaded`);
    if (disabled && !/roll/i.test(s.title || '')) throw new Error(`${s.id} does not say why it is disabled (title: ${s.title})`);
  }
}

When('the photographer looks at the action controls', async ({ page }) => {
  states = await buttonStates(page);
});

When('a roll of {string}, {string} loads', async ({ page }, a, b) => {
  await page.evaluate(([x, y]) => {
    const mk = (name) => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 48;
      const g = c.getContext('2d');
      g.fillStyle = name === x ? '#c8402a' : '#2a6ac8';
      g.fillRect(0, 0, 64, 48);
      return new Promise((ok) => c.toBlob((bl) => ok(new File([bl], name, { type: 'image/jpeg' })), 'image/jpeg', 0.8));
    };
    return Promise.all([mk(x), mk(y)]).then((files) => window.__darkroom.loadRoll(window.api.fromFiles(files, 'btn roll')));
  }, [a, b]);
  await page.waitForFunction(() => window.__darkroom.state.photos.length === 2);
});

Then('develop, save, print, compare and crop are disabled with a reason', async ({ page }) => {
  assertAll(states, true);
});

Then('the load controls are ready', async ({ page }) => {
  const st = await page.evaluate(() => ['#loadBtn', '#emptyLoad'].map((id) => {
    const b = document.querySelector(id);
    return b ? !b.disabled : null;
  }));
  if (!st[0] && !st[1]) throw new Error('no load control is available');
});

Then('develop, save, print, compare and crop are enabled again', async ({ page }) => {
  states = await buttonStates(page);
  assertAll(states, false);
});
