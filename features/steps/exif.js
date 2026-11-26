// Keep EXIF scenarios. Output bytes are parsed back in the page with
// Engine.exifDate, the same APP1 walk the app uses to read capture dates.
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';
import { results } from './results.js';

const { Given, Then } = createBdd();

Given(/^the photographer loaded a shot "(.+)" taken (\d{4})-(\d{2})-(\d{2})$/, async ({ page }, name, y, m, d) => {
  await openApp(page);
  await page.evaluate(async ({ name, y, m, d }) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#b34d2e';
    x.fillRect(0, 0, c.width, c.height);
    const base = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());

    // a minimal EXIF APP1 carrying DateTimeOriginal, to play the camera
    const dateStr = `${y}:${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')} 10:00:00\0`;
    const t = new Uint8Array(96);
    const v = new DataView(t.buffer);
    t.set([0x49, 0x49], 0); v.setUint16(2, 42, true); v.setUint32(4, 8, true);
    v.setUint16(8, 2, true);
    v.setUint16(10, 0x0132, true); v.setUint16(12, 2, true); v.setUint32(14, 20, true); v.setUint32(18, 56, true);
    v.setUint16(22, 0x8769, true); v.setUint16(24, 4, true); v.setUint32(26, 1, true); v.setUint32(30, 38, true);
    v.setUint32(34, 0, true);
    v.setUint16(38, 1, true);
    v.setUint16(40, 0x9003, true); v.setUint16(42, 2, true); v.setUint32(44, 20, true); v.setUint32(48, 76, true);
    v.setUint32(52, 0, true);
    for (let i = 0; i < 20; i++) { t[56 + i] = dateStr.charCodeAt(i); t[76 + i] = dateStr.charCodeAt(i); }
    const seg = new Uint8Array(4 + 6 + 96);
    const sv = new DataView(seg.buffer);
    sv.setUint16(0, 0xffe1);
    sv.setUint16(2, 104);
    seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
    seg.set(t, 10);
    let at = 2;
    const bv = new DataView(base.buffer);
    if (bv.getUint16(2) === 0xffe0) at = 2 + 2 + bv.getUint16(4);
    const out = new Uint8Array(base.length + seg.length);
    out.set(base.subarray(0, at), 0);
    out.set(seg, at);
    out.set(base.subarray(at), at + seg.length);

    const f = new File([out], name, { type: 'image/jpeg' });
    await window.__darkroom.loadRoll(window.api.fromFiles([f], ''));
  }, { name, y: Number(y), m: Number(m), d: Number(d) });
});

Given('the photographer turns Keep EXIF on', async ({ page }) => {
  await page.evaluate(() => { window.__darkroom.state.s.keepExif = true; });
});

Given('the photographer turns the GPS coordinates toggle on', async ({ page }) => {
  await page.evaluate(() => { window.__darkroom.state.s.gpsExif = true; });
});

const parsedDate = async (page) => {
  const bytes = [...readFileSync(await results.downloads[0].path())];
  return page.evaluate(async (b) => Engine.exifDate(new Blob([new Uint8Array(b)])), bytes);
};

Then('the result JPG carries no EXIF', async ({ page }) => {
  expect(await parsedDate(page)).toBeNull();
});

Then(/^the result JPG's capture date reads (\d{4})-(\d{2})-(\d{2})$/, async ({ page }, y, m, d) => {
  const date = await parsedDate(page);
  expect(date).not.toBeNull();
  expect(date.getFullYear()).toBe(Number(y));
  expect(date.getMonth() + 1).toBe(Number(m));
  expect(date.getDate()).toBe(Number(d));
});

// ---------- the source camera's story (PS-34) ----------
// The source JPG's EXIF is built in the page from a plain canvas encode, the
// same way the date scenarios play the camera. The result bytes are parsed
// back in Node below, with a reader written independently of the app's.

// spec: { date?, make?, model?, lensMake?, lensModel?, iso?, exposure?: [n, d],
//         fnumber?: [n, d], gps?: { lat, latRef, lon, lonRef } }
async function loadExifShot(page, name, spec) {
  await openApp(page);
  await page.evaluate(async ({ name, spec }) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#b34d2e';
    x.fillRect(0, 0, c.width, c.height);
    const base = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());

    // A little-endian TIFF writer for one APP1. Entries: { ifd, tag, type, val }.
    const A = 2, S = 3, L = 4, R = 5;
    const ascii = (s) => { const b = new Uint8Array(s.length + 1); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
    const u16v = (n) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
    const rat = (n, d) => { const b = new Uint8Array(8); const v = new DataView(b.buffer); v.setUint32(0, n, true); v.setUint32(4, d, true); return b; };
    const dms = (dec) => {
      const d = Math.floor(dec), m = Math.floor((dec - d) * 60);
      return [rat(d, 1), rat(m, 1), rat(Math.round(((dec - d) * 60 - m) * 60 * 10000), 10000)];
    };

    const s0 = [], s1 = [], s2 = [];
    const put = (ifd, tag, type, val, count) => ifd.push({ tag, type, count, val });
    if (spec.make) put(s0, 0x010f, A, ascii(spec.make));
    if (spec.model) put(s0, 0x0110, A, ascii(spec.model));
    if (spec.date) put(s0, 0x0132, A, ascii(spec.date));
    if (spec.date) put(s1, 0x9003, A, ascii(spec.date));
    if (spec.iso != null) put(s1, 0x8827, S, u16v(spec.iso), 1);
    if (spec.exposure) put(s1, 0x829a, R, rat(spec.exposure[0], spec.exposure[1]), 1);
    if (spec.fnumber) put(s1, 0x829d, R, rat(spec.fnumber[0], spec.fnumber[1]), 1);
    if (spec.lensMake) put(s1, 0xa433, A, ascii(spec.lensMake));
    if (spec.lensModel) put(s1, 0xa434, A, ascii(spec.lensModel));
    if (spec.gps) {
      put(s2, 0x0001, A, ascii(spec.gps.latRef));
      put(s2, 0x0002, R, concat(dms(spec.gps.lat)), 3);
      put(s2, 0x0003, A, ascii(spec.gps.lonRef));
      put(s2, 0x0004, R, concat(dms(spec.gps.lon)), 3);
    }
    function concat(list) { const n = list.reduce((a, b) => a + b.length, 0); const b = new Uint8Array(n); let p = 0; for (const x of list) { b.set(x, p); p += x.length; } return b; }

    if (s1.length) put(s0, 0x8769, L, null, 1);
    if (s2.length) put(s0, 0x8825, L, null, 1);
    for (const s of [s0, s1, s2]) s.sort((a, b) => a.tag - b.tag);
    const sz = (s) => 2 + 12 * s.length + 4;
    const off0 = 8, off1 = off0 + sz(s0), off2 = off1 + sz(s1), dataAt = off2 + sz(s2);
    let dataLen = 0;
    const ext = (en) => (en.val && en.val.length > 4 ? en.val.length + (en.val.length & 1) : 0);
    for (const s of [s0, s1, s2]) for (const en of s) dataLen += ext(en);
    const buf = new Uint8Array(dataAt + dataLen);
    const v = new DataView(buf.buffer);
    buf.set([0x49, 0x49], 0); v.setUint16(2, 42, true); v.setUint32(4, 8, true);
    const at = [off0, off1, off2];
    let p = 8;
    for (let i = 0; i < 3; i++) {
      if (!{ 0: s0, 1: s1, 2: s2 }[i].length) continue;
      v.setUint16(p, { 0: s0, 1: s1, 2: s2 }[i].length, true);
      let dp = dataAt;
      // recompute the running data offset across earlier IFDs
      for (let j = 0; j < i; j++) for (const en of { 0: s0, 1: s1, 2: s2 }[j]) dp += ext(en);
      let ep = p + 2;
      for (const en of { 0: s0, 1: s1, 2: s2 }[i]) {
        v.setUint16(ep, en.tag, true); v.setUint16(ep + 2, en.type, true); v.setUint32(ep + 4, en.count ?? en.val.length, true);
        if (en.val === null) { v.setUint32(ep + 8, at[en.tag === 0x8769 ? 1 : 2], true); }
        else if (en.val.length <= 4) buf.set(en.val, ep + 8);
        else { v.setUint32(ep + 8, dp, true); buf.set(en.val, dp); dp += en.val.length + (en.val.length & 1); }
        ep += 12;
      }
      v.setUint32(ep, 0, true);
      p = ep + 4;
    }
    const seg = new Uint8Array(4 + 6 + buf.length);
    const sv = new DataView(seg.buffer);
    sv.setUint16(0, 0xffe1);
    sv.setUint16(2, seg.length - 2);
    seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
    seg.set(buf, 10);
    let at2 = 2;
    const bv = new DataView(base.buffer);
    if (bv.getUint16(2) === 0xffe0) at2 = 2 + 2 + bv.getUint16(4);
    const out = new Uint8Array(base.length + seg.length);
    out.set(base.subarray(0, at2), 0);
    out.set(seg, at2);
    out.set(base.subarray(at2), at2 + seg.length);
    const f = new File([out], name, { type: 'image/jpeg' });
    await window.__darkroom.loadRoll(window.api.fromFiles([f], ''));
  }, { name, spec });
}

Given(/^the photographer loaded a shot "(.+)" shot on a "(.+)" "(.+)"(?: with a "(.+)" "(.+)" lens)? at ISO (\d+), (\d+)\/(\d+) s and f\/([\d.]+)$/,
  async ({ page }, name, make, model, lensMake, lensModel, iso, en, ed, fn) => {
    await loadExifShot(page, name, {
      make, model, iso: Number(iso),
      exposure: [Number(en), Number(ed)],
      fnumber: [Math.round(Number(fn) * 10), 10],
      ...(lensMake ? { lensMake, lensModel } : {}),
    });
  });

Given(/^the photographer loaded a shot "(.+)" taken (\d{4})-(\d{2})-(\d{2}) carrying GPS ([\d.]+) (north|south) ([\d.]+) (east|west)$/,
  async ({ page }, name, y, m, d, lat, latRef, lon, lonRef) => {
    await loadExifShot(page, name, {
      date: `${y}:${m}:${d} 10:00:00`,
      gps: { lat: Number(lat), latRef: latRef[0].toUpperCase(), lon: Number(lon), lonRef: lonRef[0].toUpperCase() },
    });
  });

// Independent read-back of the result JPG's EXIF: walks the markers and the
// TIFF structure in Node, nothing shared with the app's writer.
function readExif(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (v.getUint16(0) !== 0xffd8) return null;
  let o = 2;
  while (o + 4 < buf.length) {
    const m = v.getUint16(o);
    if ((m & 0xff00) !== 0xff00) break;
    const len = v.getUint16(o + 2);
    if (m === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return readTiff(v, o + 10);
    o += 2 + len;
  }
  return null;
}

function readTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
  const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const readVal = (type, count, at) => {
    if (type === 2) {
      let s = '';
      for (let i = 0; i < count - 1; i++) s += String.fromCharCode(v.getUint8(at + i));
      return s;
    }
    if (type === 3) { const a = []; for (let i = 0; i < count; i++) a.push(v.getUint16(at + i * 2, le)); return a.length === 1 ? a[0] : a; }
    if (type === 4) { const a = []; for (let i = 0; i < count; i++) a.push(v.getUint32(at + i * 4, le)); return a.length === 1 ? a[0] : a; }
    if (type === 5 || type === 10) {
      const a = [];
      for (let i = 0; i < count; i++) a.push([v.getUint32(at + i * 8, le), v.getUint32(at + i * 8 + 4, le)]);
      return a.length === 1 ? a[0] : a;
    }
    return null;
  };
  const ifd = (off) => {
    const n = u16(t + off), out = {};
    for (let i = 0; i < n; i++) {
      const e = t + off + 2 + i * 12;
      const type = u16(e + 2), count = u32(e + 4);
      const sz = (SIZES[type] || 1) * count;
      out[u16(e)] = readVal(type, count, sz <= 4 ? e + 8 : t + u32(e + 8));
    }
    return out;
  };
  const ifd0 = ifd(u32(t + 4));
  return {
    ifd0,
    exif: ifd0[0x8769] ? ifd(ifd0[0x8769]) : null,
    gps: ifd0[0x8825] ? ifd(ifd0[0x8825]) : null,
  };
}

const resultExif = async () => readExif(readFileSync(await results.downloads[0].path()));

Then(/^the result JPG carries camera "(.+)" and model "(.+)"$/, async ({}, make, model) => {
  const x = await resultExif();
  expect(x.ifd0[0x010f]).toBe(make);
  expect(x.ifd0[0x0110]).toBe(model);
});

Then(/^the result JPG carries the lens "(.+)" "(.+)"$/, async ({}, make, model) => {
  const x = await resultExif();
  expect(x.exif[0xa433]).toBe(make);
  expect(x.exif[0xa434]).toBe(model);
});

Then(/^the result JPG carries ISO (\d+), exposure (\d+)\/(\d+) and f-number ([\d.]+)$/, async ({}, iso, en, ed, fn) => {
  const x = await resultExif();
  expect(x.exif[0x8827]).toBe(Number(iso));
  expect(x.exif[0x829a]).toEqual([Number(en), Number(ed)]);
  const [num, den] = x.exif[0x829d];
  expect(num / den).toBeCloseTo(Number(fn), 6);
});

Then('the result JPG carries no camera information', async () => {
  const x = await resultExif();
  expect(x.ifd0[0x010f]).toBeUndefined();
  expect(x.ifd0[0x0110]).toBeUndefined();
  expect(x.ifd0[0x8825]).toBeUndefined();
});

Then('the result JPG carries no GPS coordinates', async () => {
  const x = await resultExif();
  expect(x.ifd0[0x8825]).toBeUndefined();
  expect(x.gps).toBeNull();
});

Then(/^the result JPG carries GPS ([\d.]+) (north|south) ([\d.]+) (east|west)$/, async ({}, lat, latRef, lon, lonRef) => {
  const x = await resultExif();
  const dec = (r, ref) => {
    expect(r.length).toBe(3);
    const v = r[0][0] / r[0][1] + r[1][0] / r[1][1] / 60 + r[2][0] / r[2][1] / 3600;
    return ref[0].toUpperCase() === 'S' || ref[0].toUpperCase() === 'W' ? -v : v;
  };
  expect(x.gps[0x0001][0]).toBe(latRef[0].toUpperCase());
  expect(dec(x.gps[0x0002], latRef)).toBeCloseTo(Number(lat), 5);
  expect(x.gps[0x0003][0]).toBe(lonRef[0].toUpperCase());
  expect(dec(x.gps[0x0004], lonRef)).toBeCloseTo(Number(lon), 5);
});
