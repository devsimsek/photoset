// PDF writer scenarios (PS-37): the steps parse the produced bytes instead of
// trusting the writer. The PDF is built in the page through the writer's
// public API (the page's canvas makes the JPEG a step embeds) and crosses to
// Node as base64.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { openApp } from './helpers.js';

const { Given, When, Then } = createBdd();

const doc = { spec: null, buf: null };

Given(/^a one-page PDF with the text "(.+)"$/, ({}, text) => {
  doc.spec = { text };
});

Given(/^a one-page PDF with a (\d+)x(\d+) JPEG image$/, ({}, w, h) => {
  doc.spec = { jpeg: { w: Number(w), h: Number(h) } };
});

When('the writer serialises it', async ({ page }) => {
  expect(doc.spec, 'the scenario never declared a PDF').not.toBeNull();
  doc.buf = await buildPdf(page, doc.spec);
});

async function buildPdf(page, spec) {
  await openApp(page);
  const b64 = await page.evaluate(async (spec) => {
    const d = Pdf.document();
    const p = d.page();
    if (spec.text) p.text(spec.text, 72, 720, { size: 12 });
    if (spec.jpeg) {
      const c = document.createElement('canvas');
      c.width = spec.jpeg.w;
      c.height = spec.jpeg.h;
      const x = c.getContext('2d');
      x.fillStyle = '#b34d2e';
      x.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      p.jpeg(bytes, spec.jpeg.w, spec.jpeg.h, 72, 300, 200, 150);
    }
    const out = d.end();
    let s = '';
    for (let i = 0; i < out.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }, spec);
  return Buffer.from(b64, 'base64');
}

Then(/^the bytes start with "%PDF-" and end with "%%EOF"$/, () => {
  const s = doc.buf.toString('latin1');
  expect(s.startsWith('%PDF-')).toBe(true);
  expect(s.endsWith('%%EOF')).toBe(true);
});

Then(/^every xref offset lands exactly on its own "N 0 obj"$/, () => {
  const s = doc.buf.toString('latin1');
  const xrefOff = Number(s.slice(s.lastIndexOf('startxref') + 9).match(/\d+/)[0]);
  expect(s.slice(xrefOff, xrefOff + 4)).toBe('xref');
  const lines = s.slice(xrefOff).split('\n');
  expect(lines[0]).toBe('xref');
  const [first, count] = lines[1].split(' ').map(Number);
  expect(first).toBe(0);
  expect(count).toBeGreaterThan(1);
  const offsets = lines.slice(2, 2 + count).map((entry) => ({
    offset: Number(entry.slice(0, 10)),
    type: entry.slice(17, 18), // the status char sits after the 5-digit generation
  }));
  expect(offsets[0].type).toBe('f'); // object 0 is the free head of the chain
  for (let n = 1; n < count; n++) {
    expect(offsets[n].type, `object ${n}`).toBe('n');
    expect(doc.buf.subarray(offsets[n].offset, offsets[n].offset + 16).toString('latin1'))
      .toMatch(new RegExp(`^${n} 0 obj`));
  }
});

Then(/^the image object carries the JPEG's dimensions with DCTDecode$/, () => {
  const s = doc.buf.toString('latin1');
  const m = s.match(/\/Subtype \/Image \/Width (\d+) \/Height (\d+) [^>]*\/Filter \/DCTDecode/);
  expect(m, 'no embedded image object found').not.toBeNull();
  // The embedded JPEG's own SOF frame header must agree with the dictionary.
  const dims = jpegSofDims(doc.buf);
  expect(Number(m[1])).toBe(dims.w);
  expect(Number(m[2])).toBe(dims.h);
});

function jpegSofDims(buf) {
  let p = 2;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    if (marker === 0xff) { p++; continue; } // padding byte
    // SOFn frame headers carry the pixel dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
    }
    // Standalone markers (SOI, EOI, RST, TEM) carry no length field.
    const standalone = marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01;
    p += standalone ? 2 : 2 + buf.readUInt16BE(p + 2);
  }
  throw new Error('no SOF frame found in the embedded JPEG');
}

Then(/^the text stream carries the escaped string "(.+)"$/, ({}, expected) => {
  const s = doc.buf.toString('latin1');
  expect(s).toContain(expected);
});
