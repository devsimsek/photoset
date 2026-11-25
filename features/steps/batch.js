// Batch error reporting (PS-25): a failed shot is named with a reason at the
// end of the run, and the successes still complete.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { quoted, loadRoll } from './helpers.js';

const { Given, Then } = createBdd();

const toastMsg = (page) => page.evaluate(() => document.querySelector('#toastMsg').textContent);

Given(/^the photographer loaded a roll where "(.+?)" is undecodable garbage$/, async ({ page }, bad) => {
  const names = ['a.jpg', bad, 'c.jpg'].filter((n, i, a) => a.indexOf(n) === i);
  await loadRoll(page, names.map((name) => ({ name, garbage: name === bad })), '');
});

Then(/^the toast reports "(.+)"$/, async ({ page }, text) => {
  await expect.poll(() => toastMsg(page), {
    timeout: 10000,
    message: `no toast mentioning "${text}" appeared`,
  }).toMatch(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

Then(/^the toast names "(.+?)" with a reason$/, async ({ page }, name) => {
  await expect.poll(() => toastMsg(page), {
    timeout: 10000,
    message: `no toast naming ${name} appeared`,
  }).toMatch(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  // the toast is on screen right now; read it and demand a reason
  const msg = await toastMsg(page);
  expect(msg, 'the failure carries a reason in parentheses').toMatch(/\(.+\)/);
});

Then('the toast reports a batch with no failures', async ({ page }) => {
  await expect.poll(() => toastMsg(page), {
    timeout: 10000,
    message: 'no develop toast appeared',
  }).toMatch(/Developed \d+/);
  const msg = await toastMsg(page);
  expect(msg).not.toMatch(/failed/i);
});
