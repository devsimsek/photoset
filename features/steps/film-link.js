// Film-as-URL and QR scenarios (PS-36). The link is built by the app itself,
// opened as a real navigation (boot import path), and the QR is checked
// module by module against the encoder's own matrix.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { When, Then } = createBdd();

const openApp = async (page) => page.waitForFunction(() => !!(window.api && window.__darkroom));

// A shared link opens the app fresh. When the darkroom is already booted at
// the same address the hash change alone is a same-document navigation, so the
// step forces the real boot a fresh link open gets.
const openLink = async (page, url) => {
  await page.goto(url);
  await page.reload();
  await openApp(page);
};

When(/the photographer opens the film's share link$/, async ({ page }) => {
  const url = await page.evaluate(() => window.__darkroom.filmLink());
  expect(url).toMatch(/#film=/);
  // The film arrives through the hash, not through the library: the session
  // that opens the link has never saved it.
  await page.evaluate(() => localStorage.removeItem('darkroom.films'));
  await openLink(page, url);
  expect(await page.evaluate(() => window.__darkroom.state.stock)).toBe('koda-64');
});

When(/the photographer opens a link whose hash is a broken film$/, async ({ page }) => {
  const film = JSON.stringify({ schema: 3, id: 'broken', name: 'Broken', iso: '1', look: {} });
  const b64 = Buffer.from(film, 'utf8').toString('base64url');
  await openLink(page, `/#film=${b64}`);
});

Then('the address bar carries no film hash', async ({ page }) => {
  expect(await page.evaluate(() => window.location.hash)).toBe('');
});

When('the photographer opens the film dialog for the QR', async ({ page }) => {
  await page.click('#saveFilmBtn');
  await page.waitForFunction(() => {
    const c = document.querySelector('#filmQr');
    return c && !c.hidden && c.width > 0 || undefined;
  }, { timeout: 5000 });
});

Then('the QR is drawn with the module matrix of the share link', async ({ page }) => {
  const bad = await page.evaluate(() => {
    const link = window.__darkroom.filmLink();
    const m = Qr.matrix(link);
    if (!m) return { fail: 'no matrix for the share link' };
    const c = document.querySelector('#filmQr');
    if (c.width !== (m[0].length + 2 * Qr.QUIET) * Qr.SCALE) return { fail: 'canvas size mismatch' };
    const x = c.getContext('2d');
    for (let r = 0; r < m.length; r++) {
      for (let col = 0; col < m[r].length; col++) {
        const px = x.getImageData((Qr.QUIET + col) * Qr.SCALE + (Qr.SCALE >> 1),
          (Qr.QUIET + r) * Qr.SCALE + (Qr.SCALE >> 1), 1, 1).data;
        const dark = px[3] > 0 && px[0] < 128;
        if (dark !== !!m[r][col]) return { fail: 'module mismatch', r, col };
      }
    }
    return null;
  });
  expect(bad).toBeNull();
});

When('the photographer looks at a film whose link is longer than a QR can hold', async ({ page }) => {
  await page.evaluate(() => { window.__tooBig = Qr.matrix('a'.repeat(3000)); });
});

Then('the QR is skipped and the link is offered alone', async ({ page }) => {
  expect(await page.evaluate(() => window.__tooBig)).toBeNull();
  // A normal film still gets a QR.
  expect(await page.evaluate(() => !!Qr.matrix(window.__darkroom.filmLink()))).toBe(true);
});
