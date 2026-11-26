// Phone layout scenarios (PS-22): 375px-first layout and 44px touch targets.
// Playwright opens a fresh context per scenario, so resizing the page right
// after open gives exactly the phone window the feature asks for.
//
// PS-31 adds the intake-hardening steps: big rolls, the intake progress line,
// a named error for unreadable shots, and the chunked folder read. The drop
// step drives the app's real window drop handler with a fake directory entry
// standing in for the entry a browser builds from a dropped folder; its
// file() calls count concurrency so the chunked read is pinned at the
// observable level.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { openApp, quoted, loadRoll } from './helpers.js';

const { Given, When, Then } = createBdd();

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

// ---------- PS-31: the intake survives a whole phone's folder ----------

// Records the intake line (every text change through a MutationObserver, so
// advancement is pinned exactly, not by sampling) and when tiles paint. The
// fake directory entry from the drop step counts its file() calls here.
async function startTrace(page) {
  await page.evaluate(() => {
    const line = document.querySelector('#intakeLine');
    window.__loadTrace = { lines: [], samples: [], fileCalls: 0, maxConcurrent: 0 };
    new MutationObserver(() => {
      if (!line.hidden) window.__loadTrace.lines.push(line.textContent);
    }).observe(line, { childList: true, characterData: true, subtree: true });
    window.__traceTimer = setInterval(() => {
      window.__loadTrace.samples.push({
        line: line.hidden ? null : line.textContent,
        tiles: document.querySelectorAll('.roll-item').length,
      });
    }, 40);
  });
}

const readTrace = (page) => page.evaluate(() => {
  clearInterval(window.__traceTimer);
  window.__traceTimer = 0;
  return window.__loadTrace;
});

// A big roll of tiny synthetic JPEGs, built in-page like the load helper does.
async function loadPhoneRoll(page, count) {
  await openApp(page);
  await startTrace(page);
  await page.evaluate(async (n) => {
    const makeJpeg = async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      const x = c.getContext('2d');
      x.fillStyle = '#b34d2e';
      x.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return new Uint8Array(await blob.arrayBuffer());
    };
    const files = [];
    for (let i = 1; i <= n; i++) {
      files.push(new File([await makeJpeg()], `shot_${String(i).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
    }
    await window.__darkroom.loadRoll(window.api.fromFiles(files, 'phone roll'));
  }, count);
  await page.evaluate(() => window.__darkroom.whenReady());
}

When(/^the photographer loads a roll of (\d+) phone shots$/, (async ({ page }, count) => {
  await loadPhoneRoll(page, Number(count));
}));

Then(/^only a bounded batch of contact sheet tiles exists before any scrolling$/, async ({ page }) => {
  const counts = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.roll-item').length,
    photos: window.__darkroom.state.photos.length,
  }));
  expect(counts.photos).toBe(300);
  expect(counts.tiles, 'the sheet starts with some tiles').toBeGreaterThan(0);
  expect(counts.tiles, 'the sheet stays bounded, not one node per photo').toBeLessThan(counts.photos);
  expect(counts.tiles, 'the up-front batch the app renders').toBeLessThanOrEqual(64);
});

When(/^the photographer walks to "(.+?)" with the keyboard$/, async ({ page }, name) => {
  const idx = await page.evaluate((n) => window.__darkroom.state.photos.findIndex((p) => p.name === n), name);
  expect(idx, `no shot named ${name} in the roll`).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < idx; i++) await page.keyboard.press('j');
});

When('the photographer scrolls the contact sheet to the end', async ({ page }) => {
  // Reaching for the bottom over and over, the way a thumb works down a huge
  // sheet while the tiles keep rendering under it.
  await page.waitForFunction(() => {
    const list = document.querySelector('#rollList');
    list.scrollTop = list.scrollHeight;
    return document.querySelectorAll('.roll-item').length >= window.__darkroom.state.photos.length;
  }, undefined, { timeout: 15000 });
});

Then(/^tiles have appeared for the shots further down the roll$/, async ({ page }) => {
  const counts = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.roll-item').length,
    photos: window.__darkroom.state.photos.length,
  }));
  expect(counts.tiles).toBe(counts.photos);
  expect(counts.tiles).toBeGreaterThan(64);
});

When('the photographer taps the last tile on the contact sheet', async ({ page }) => {
  await page.locator('.roll-item').last().click();
});

Then(/^a progress line with a count shows while the roll is being prepared$/, async ({ page }) => {
  const trace = await readTrace(page);
  const withCount = trace.lines.filter((t) => /Preparing \d+ \/ \d+/.test(t));
  expect(withCount.length, 'the intake line showed counts while shots were prepared').toBeGreaterThan(0);
  const seen = trace.samples.some((s) => s.line && s.tiles > 0);
  expect(seen, 'the line was visible on screen while tiles existed').toBe(true);
});

Then(/^the progress line advances while the roll is being prepared$/, async ({ page }) => {
  const trace = await readTrace(page);
  const counts = trace.lines
    .map((t) => t.match(/Preparing (\d+) \/ \d+/)?.[1])
    .filter(Boolean)
    .map(Number);
  expect(counts.length, 'several counts were shown').toBeGreaterThanOrEqual(2);
  for (let i = 1; i < counts.length; i++) {
    expect(counts[i], 'the count rose as shots were prepared').toBeGreaterThan(counts[i - 1]);
  }
});

Then(/^the progress line is gone once the roll is ready$/, async ({ page }) => {
  const hidden = await page.evaluate(() => document.querySelector('#intakeLine').hidden);
  expect(hidden, 'the intake line is hidden once the roll is ready').toBe(true);
});

When(/^the photographer loads "(.+?)" and "(.+?)" where "(.+?)" is unreadable$/,
  async ({ page }, first, second, bad) => {
    await loadRoll(page, [first, second].map((name) => ({ name, garbage: name === bad })), '');
  });

Then(/^a toast names "(.+?)" as unreadable$/, async ({ page }, name) => {
  await expect.poll(() => page.evaluate(() => document.querySelector('#toastMsg')?.textContent ?? ''), {
    timeout: 10000,
    message: `no toast naming ${name} appeared during intake`,
  }).toMatch(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

Then(/^"(.*?)" stays listed with its name and size$/, async ({ page }, name) => {
  const shot = await page.evaluate((n) => {
    const p = window.__darkroom.state.photos.find((q) => q.name === n);
    if (!p || !p.el) return null;
    return {
      size: p.size,
      tileName: p.el.querySelector('.ri-name').textContent,
      tileSize: p.el.querySelector('.ri-size').textContent,
    };
  }, name);
  expect(shot, `${name} is listed on the sheet`).toBeTruthy();
  expect(shot.size, 'the metadata survived the failed decode').toBeGreaterThan(0);
  expect(shot.tileName).toBe(name);
  expect(shot.tileSize, 'the size is shown on the tile').toContain('200 B');
});

// The drop handler needs dataTransfer.files non-empty even for a folder, so
// the fake carries a placeholder. The entries carry real in-page JPEG files
// with a small delay per file() call, so chunk boundaries are observable.
When(/^the photographer drops a folder of (\d+) phone shots$/, async ({ page }, count) => {
  await openApp(page);
  await startTrace(page);
  await page.evaluate(async ({ count: n, delay }) => {
    const makeJpeg = async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      const x = c.getContext('2d');
      x.fillStyle = '#b34d2e';
      x.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return new Uint8Array(await blob.arrayBuffer());
    };
    const files = [];
    for (let i = 1; i <= n; i++) {
      files.push(new File([await makeJpeg()], `shot_${String(i).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
    }
    let inflight = 0;
    const entry = {
      name: 'phone roll',
      isDirectory: true,
      createReader() {
        let sent = false;
        return {
          readEntries(ok) {
            if (sent) return ok([]);
            sent = true;
            ok(files.map((f) => ({
              isFile: true,
              name: f.name,
              file(okCb) {
                window.__loadTrace.fileCalls++;
                inflight++;
                window.__loadTrace.maxConcurrent = Math.max(window.__loadTrace.maxConcurrent, inflight);
                setTimeout(() => { inflight--; okCb(f); }, delay);
              },
            })));
          },
        };
      },
    };
    const dt = {
      items: [{ kind: 'file', webkitGetAsEntry: () => entry }],
      files: [new File([], 'placeholder')],
    };
    const ev = new Event('drop', { bubbles: true });
    ev.dataTransfer = dt;
    window.dispatchEvent(ev);
  }, { count: Number(count), delay: 40 });
  await page.waitForFunction(() => window.__darkroom.state.photos.length > 0, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__darkroom.whenReady());
});

Then(/^the folder is read in chunks of at most (\d+) shots with rising counts$/, async ({ page }, chunk) => {
  const trace = await readTrace(page);
  const total = await page.evaluate(() => window.__darkroom.state.photos.length);
  const log = await page.evaluate(() => window.__intakeLog);
  expect(total).toBe(300);
  expect(trace.fileCalls, 'every shot was read exactly once').toBe(total);
  expect(trace.maxConcurrent, `no more than ${chunk} metadata reads in flight`).toBeLessThanOrEqual(Number(chunk));
  expect(log.length, `the ${total} reads reported in chunks`).toBeGreaterThan(1);
  expect(log[0], 'the first report is one chunk in').toBe(`${Math.min(Number(chunk), total)}/${total}`);
  expect(log[log.length - 1], 'the last report is the whole folder').toBe(`${total}/${total}`);
  const counts = log.map((s) => Number(s.split('/')[0]));
  for (let i = 1; i < counts.length; i++) {
    expect(counts[i], 'the reported count rose chunk by chunk').toBeGreaterThan(counts[i - 1]);
  }
  const reading = trace.lines.filter((t) => /Reading \d+ \/ \d+/.test(t));
  expect(reading.length, 'the reading counts reached the visible line').toBeGreaterThan(0);
});

Then('the contact sheet already shows tiles while the folder is still being prepared', async ({ page }) => {
  const trace = await readTrace(page);
  const painted = trace.samples.some((s) => s.line && s.tiles > 0);
  expect(painted, 'a painted tile was on screen while the intake line was still up').toBe(true);
});
