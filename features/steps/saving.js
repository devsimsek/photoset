import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Then } = createBdd();
import { readFileSync } from 'node:fs';
import { quoted, zipEntries, startsWithMagic } from './helpers.js';
import { results } from './results.js';

Then(/^the result "(.+)" downloads as a JPG$/, async ({}, name) => {
  const download = results.downloads[0];
  expect(download.suggestedFilename()).toBe(name);
  const buf = readFileSync(await download.path());
  expect(startsWithMagic(buf, 'jpg')).toBe(true);
});

Then(/^the results download as one file named "(.+)"$/, async ({}, name) => {
  expect(results.downloads).toHaveLength(1);
  expect(results.downloads[0].suggestedFilename()).toBe(name);
});

Then(/^the zip holds (.+)$/, async ({}, list) => {
  const expected = quoted(list);
  const buf = readFileSync(await results.downloads[0].path());
  expect(startsWithMagic(buf, 'zip')).toBe(true);
  const got = zipEntries(buf).map((e) => e.name);
  expect([...got].sort()).toEqual([...expected].sort());
});
