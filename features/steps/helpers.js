// Shared helpers for the BDD steps. They drive the app through the surfaces a
// real session uses: window.api (the bridge) and window.__darkroom (app state).
import { readFileSync } from 'node:fs';
import { results } from './results.js';

// All quoted strings in a step text:  "a", "b" and "c"  →  ['a', 'b', 'c']
export function quoted(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// Loads a roll through api.fromFiles and window.__darkroom.loadRoll, building
// real JPEG bytes in the page. specs: [{ name, rel?, busy?, garbage?, asym?,
// tone? }] where rel is the fake webkitRelativePath a browser would report
// for folder picks, busy makes a larger, high-detail (incompressible) 256x192
// shot, garbage swaps the bytes for undecodable noise that still carries a
// .jpg name, asym makes a 160x80 shot with red on the left and blue on the
// right, and tone makes a 120x80 shot filled with the given colour, for the
// rotation, crop and half-frame scenarios to sample.
export async function loadRoll(page, specs, rollName) {
  await openApp(page);
  return page.evaluate(async ({ specs, rollName }) => {
    const makeJpeg = async (busy, garbage, asym, tone) => {
      if (garbage) return crypto.getRandomValues(new Uint8Array(200));
      const c = document.createElement('canvas');
      c.width = busy ? 256 : asym ? 160 : tone ? 120 : 64;
      c.height = busy ? 192 : asym || tone ? 80 : 48;
      const x = c.getContext('2d');
      if (tone) {
        x.fillStyle = tone;
        x.fillRect(0, 0, c.width, c.height);
      } else if (asym) {
        x.fillStyle = '#ff0000';
        x.fillRect(0, 0, 80, 80);
        x.fillStyle = '#0000ff';
        x.fillRect(80, 0, 80, 80);
      } else if (busy) {
        const id = x.createImageData(c.width, c.height);
        let s = 0x9e3779b9 >>> 0;
        for (let i = 0; i < id.data.length; i += 4) {
          s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0;
          id.data[i] = s & 255;
          id.data[i + 1] = (s >>> 8) & 255;
          id.data[i + 2] = (s >>> 16) & 255;
          id.data[i + 3] = 255;
        }
        x.putImageData(id, 0, 0);
      } else {
        x.fillStyle = '#b34d2e';
        x.fillRect(0, 0, c.width, c.height);
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return new Uint8Array(await blob.arrayBuffer());
    };
    const files = [];
    for (const s of specs) {
      const f = new File([await makeJpeg(!!s.busy, !!s.garbage, !!s.asym, s.tone)], s.name, { type: 'image/jpeg' });
      if (s.rel) Object.defineProperty(f, 'webkitRelativePath', { value: s.rel });
      files.push(f);
    }
    const roll = window.api.fromFiles(files, rollName || '');
    await window.__darkroom.loadRoll(roll);
    return window.__darkroom.state.photos.map((p) => p.name);
  }, { specs, rollName });
}

// Opens the app and waits for the bridge and app state to exist.
export async function openApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
}

// Resolves the latest run's outputs as [{ name, bytes }]: a single download
// decodes as itself, a batch zip unpacks to its entries.
export async function resultBlobs(page) {
  const download = results.downloads[0];
  const buf = readFileSync(await download.path());
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    return zipEntries(buf).map((e) => ({ name: e.name, bytes: new Uint8Array(e.data) }));
  }
  return [{ name: download.suggestedFilename(), bytes: new Uint8Array(buf) }];
}

// Decodes a developed download in the page and samples small square patches,
// averaged so JPEG ringing never flips an assertion. spots: [fx, fy] pairs in
// output fractions; at indexes the resolved outputs. Returns
// { w, h, spots: [[r, g, b], ...] }.
export async function probeResult(page, spots, at = 0) {
  const bytes = (await resultBlobs(page))[at].bytes;
  return page.evaluate(async ({ bytes, spots }) => {
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const x = c.getContext('2d');
    x.drawImage(bmp, 0, 0);
    bmp.close();
    const avg = (fx, fy, rad) => {
      const r = rad || 4, px = Math.min(c.width - 5, Math.max(4, Math.round(fx * c.width))),
        py = Math.min(c.height - 5, Math.max(4, Math.round(fy * c.height)));
      const d = x.getImageData(px - r, py - r, r * 2 + 1, r * 2 + 1).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
      const n = d.length / 4;
      return sum.map((v) => v / n);
    };
    return { w: c.width, h: c.height, spots: spots.map(([a, b, r]) => avg(a, b, r)) };
  }, { bytes, spots });
}

// Patch averages land near the fill colour with JPEG wobble; the thresholds
// leave a wide honest margin on both sides.
export function isColour(name, [r, g, b]) {
  if (name === 'red') return r > 140 && g < 110 && b < 110;
  if (name === 'blue') return b > 140 && r < 110 && g < 110;
  if (name === 'green') return g > 140 && r < 110 && b < 110;
  if (name === 'dark') return r + g + b < 150;
  if (name === 'light') return r + g + b > 300;
  throw new Error('unknown probe colour ' + name);
}

export function colourFail(name, [r, g, b]) {
  return `expected ${name} at the sample point, got rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

const MAGIC = { jpg: [0xff, 0xd8], zip: [0x50, 0x4b] };

export function startsWithMagic(buf, kind) {
  return buf.length >= 4 && buf[0] === MAGIC[kind][0] && buf[1] === MAGIC[kind][1];
}

// Minimal parse of the app's zip output: stored (uncompressed) entries, local
// headers with no extra fields, followed by the central directory.
export function zipEntries(buf) {
  const entries = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const size = buf.readUInt32LE(p + 18);
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString('utf8');
    const data = buf.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    entries.push({ name, data });
    p += 30 + nameLen + extraLen + size;
  }
  return entries;
}
