import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();
import { quoted, loadRoll } from './helpers.js';

When(/^the photographer loads a folder containing (.+)$/, async ({ page }, list) => {
  await loadRoll(page, quoted(list).map((name) => ({ name })), '');
});

When(/^the photographer loads a folder "(.+?)" where "(.+?)" is on the top level and "(.+?)" sits in a "(.+?)" subfolder$/,
  async ({ page }, folder, topLevel, subLevel, subfolder) => {
    await loadRoll(page, [
      { name: topLevel, rel: `${folder}/${topLevel}` },
      { name: subLevel, rel: `${folder}/${subfolder}/${subLevel}` },
    ], '');
  });

Then(/^the roll contains exactly (.+)$/, async ({ page }, list) => {
  const expected = quoted(list);
  const got = await page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  expect([...got].sort()).toEqual([...expected].sort());
});

Then(/^the roll lists (.+) in that order$/, async ({ page }, list) => {
  const expected = quoted(list);
  const got = await page.evaluate(() => window.__darkroom.state.photos.map((p) => p.name));
  expect(got).toEqual(expected);
});
