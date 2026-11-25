// Draws the app icon (retro camera: racing stripes + big lens) and writes it as PNG.
// Pure Node, no dependencies. Output: build/icon.png (installer) and src/assets/icon.png (window).
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 512, SS = 4;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function roundRect(u, v, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(u, x1 - r)), cy = Math.max(y0 + r, Math.min(v, y1 - r));
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r && u >= x0 && u <= x1 && v >= y0 && v <= y1;
}

// returns [r,g,b,a] for a sample point (u,v in 0..1)
function sample(u, v) {
  if (!roundRect(u, v, 0.03, 0.03, 0.97, 0.97, 0.2)) return [0, 0, 0, 0];
  let c = hex('#1e1a15').map((x, i) => x + (1 - v) * [14, 10, 6][i]);

  // top plate
  if (v < 0.4) c = hex('#26211a');
  if (Math.abs(v - 0.4) < 0.006) c = hex('#0d0a08');

  // racing stripes (skewed)
  const su = u + (v - 0.28) * 0.35;
  if (su > 0.1 && su < 0.5) {
    if (v > 0.16 && v < 0.2) c = hex('#f2c230');
    else if (v > 0.22 && v < 0.26) c = hex('#ff7a1a');
    else if (v > 0.28 && v < 0.32) c = hex('#d9412b');
  }

  // viewfinder
  if (roundRect(u, v, 0.66, 0.14, 0.86, 0.29, 0.03)) c = hex('#efe4cc');
  if (roundRect(u, v, 0.685, 0.163, 0.835, 0.267, 0.02)) c = hex('#2b3b45');
  if (roundRect(u, v, 0.70, 0.175, 0.745, 0.205, 0.01)) c = hex('#6f8a96');

  // lens
  const lx = 0.5, ly = 0.64, d = Math.hypot(u - lx, v - ly);
  if (d < 0.3) c = hex('#efe4cc');
  if (d < 0.27) c = hex('#0d0a08');
  if (d < 0.255 && d > 0.245) c = hex('#ff7a1a');
  if (d < 0.2) {
    const t = d / 0.2;
    c = [20 + 25 * t, 24 + 18 * t, 34 + 12 * t];
    if (Math.abs(d - 0.13) < 0.006) c = hex('#3a5866');
    const hl = Math.hypot(u - (lx - 0.07), v - (ly - 0.07));
    if (hl < 0.05) { const k = 1 - hl / 0.05; c = c.map((x, i) => x + (hex('#ffb347')[i] - x) * k * 0.9); }
    const hl2 = Math.hypot(u - (lx + 0.08), v - (ly + 0.08));
    if (hl2 < 0.022) c = c.map((x) => x + (255 - x) * (1 - hl2 / 0.022) * 0.5);
  }
  return [c[0], c[1], c[2], 255];
}

const px = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) {
      for (let i = 0; i < SS; i++) {
        const s = sample((x + (i + 0.5) / SS) / S, (y + (j + 0.5) / SS) / S);
        r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
      }
    }
    const o = (y * S + x) * 4;
    px[o] = a ? r / a : 0; px[o + 1] = a ? g / a : 0; px[o + 2] = a ? b / a : 0; px[o + 3] = a / (SS * SS);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function encodePng(px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'src', 'renderer', 'icon.png'), encodePng(px)); // favicon / web app icon

// Maskable variant: the camera art shrunk into the safe zone (75% box keeps all
// art inside the centre circle a maskable launcher may crop to) over an opaque
// background matching the app.
const SAFE = 0.75;
const pxM = Buffer.alloc(S * S * 4);
const bg = hex('#15120e');
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) {
      for (let i = 0; i < SS; i++) {
        const u = (x + (i + 0.5) / SS) / S, v = (y + (j + 0.5) / SS) / S;
        const s = sample((u - 0.5) / SAFE + 0.5, (v - 0.5) / SAFE + 0.5);
        r += s[0] * s[3]; g += s[1] * s[3]; b += s[2] * s[3]; a += s[3];
      }
    }
    const o = (y * S + x) * 4;
    const cov = a / (SS * SS);
    if (cov === 0) { pxM[o] = bg[0]; pxM[o + 1] = bg[1]; pxM[o + 2] = bg[2]; pxM[o + 3] = 255; continue; }
    const ar = a ? r / a : 0, ag = a ? g / a : 0, ab = a ? b / a : 0;
    pxM[o] = ar * cov + bg[0] * (1 - cov);
    pxM[o + 1] = ag * cov + bg[1] * (1 - cov);
    pxM[o + 2] = ab * cov + bg[2] * (1 - cov);
    pxM[o + 3] = 255;
  }
}
fs.writeFileSync(path.join(root, 'src', 'renderer', 'icon-maskable.png'), encodePng(pxM)); // manifest maskable icon
console.log('icons written (icon ' + px.length + 'px, maskable ' + pxM.length + 'px)');
