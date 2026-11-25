import { createBdd } from 'playwright-bdd';
import { openApp } from './helpers.js';

const { Given } = createBdd();

Given('the darkroom is open', async ({ page }) => {
  await openApp(page);
});
