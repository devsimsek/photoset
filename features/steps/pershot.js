// Per-shot look scenarios (PS-60). These steps drive the real selection and
// develop surfaces and remember developed bytes per shot name, so a scenario
// can pin that editing one shot leaves another byte-identical.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadRoll, quoted, probeResult } from './helpers.js';
import { results } from './results.js';

const { Given, When, Then } = createBdd();

const ORD = { first: 0, second: 1, third: 2, fourth: 3 };

Given(/^the photographer loaded a roll of split shots (.+?)(?: in roll "(.+?)")?$/,
  async ({ page }, list, roll) => {
    await loadRoll(page, quoted(list).map((name) => ({ name, asym: true })), roll || '');
  });

When(/^the photographer re-picks the split shots (.+) in folder "(.+?)"$/,
  async ({ page }, list, folder) => {
    await loadRoll(page, quoted(list).map((name) => ({ name, asym: true, rel: `${folder}/${name}` })), folder);
  });

When(/^the photographer selects "(.+?)"$/, async ({ page }, name) => {
  await page.evaluate((n) => {
    const st = window.__darkroom.state;
    const i = st.photos.findIndex((p) => p.name === n);
    if (i < 0) throw new Error('no shot named ' + n);
    window.__darkroom.select(i);
  }, name);
});

Then(/^the (first|second|third|fourth) result is (\d+) wide by (\d+) tall$/,
  async ({ page }, which, w, h) => {
    const d = await probeResult(page, [], ORD[which]);
    if (d.w !== Number(w) || d.h !== Number(h)) {
      throw new Error(`the ${which} result is ${d.w}x${d.h}, expected ${w}x${h}`);
    }
  });

Then(/^the developed bytes are remembered for "(.+?)"$/, async ({}, name) => {
  results.perShot = results.perShot || {};
  results.perShot[name] = readFileSync(await results.downloads[0].path());
});

Then(/^the developed bytes of "(.+?)" match the remembered develop$/, async ({}, name) => {
  const buf = readFileSync(await results.downloads[0].path());
  const was = (results.perShot || {})[name];
  expect(was, `no remembered develop for ${name}`).toBeTruthy();
  expect(buf.equals(was)).toBe(true);
});

Then(/^the remembered develops of "(.+?)" and "(.+?)" differ$/, async ({}, a, b) => {
  const map = results.perShot || {};
  expect(map[a], `no remembered develop for ${a}`).toBeTruthy();
  expect(map[b], `no remembered develop for ${b}`).toBeTruthy();
  expect(map[a].equals(map[b])).toBe(false);
});
