'use strict';
/* Minimal QR encoder: byte mode, error correction level L, versions 1-40. Pure
   JS, no dependencies: hands back the module matrix and can draw it onto a
   canvas. ECC/BLOCKS are the ISO 18004 level-L tables. Verified module for
   module against the nayuki C reference and by jsQR round-trips. */
const Qr = (() => {
  const ECC = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
  const BLOCKS = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25];

  // Reed-Solomon over GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1.
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const gen = (n) => { // generator polynomial, coefficients highest degree first
    let g = [1];
    for (let i = 0; i < n; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  };
  function rsRemainder(data, n) {
    const g = gen(n), res = new Uint8Array(n);
    for (const b of data) {
      const f = b ^ res[0];
      res.copyWithin(0, 1);
      res[n - 1] = 0;
      if (f) for (let i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], f);
    }
    return res;
  }

  const rawModules = (v) => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const na = Math.floor(v / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  };
  const dataCw = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];

  const alignment = (v) => {
    if (v === 1) return []; // version 1 has no alignment patterns
    const num = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (num * 2 - 2)) * 2;
    const pos = [6];
    for (let p = v * 4 + 10; pos.length < num; p -= step) pos.splice(1, 0, p);
    return pos;
  };

  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  /** The module matrix (dark = true) for a byte payload, or null when it
      cannot fit one QR at level L. */
  function matrix(text) {
    const bytes = new TextEncoder().encode(text);
    let ver = 0;
    for (let v = 1; v <= 40; v++) {
      if (dataCw(v) * 8 >= 4 + (v <= 9 ? 8 : 16) + 8 * bytes.length) { ver = v; break; }
    }
    if (!ver) return null;
    const nData = dataCw(ver), nEcc = ECC[ver], nBlocks = BLOCKS[ver];

    // Data bits: mode 0100, byte count, bytes, terminator, pad codewords.
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, nData * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let i = 0; bits.length < nData * 8; i++) push(i % 2 ? 0x11 : 0xEC, 8);
    const data = new Uint8Array(nData);
    for (let i = 0; i < nData; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
      data[i] = b;
    }

    // Split into blocks, add EC, interleave (short blocks first).
    const shortLen = Math.floor(nData / nBlocks), numShort = nBlocks - (nData % nBlocks);
    const parts = [];
    let p = 0;
    for (let b = 0; b < nBlocks; b++) {
      const len = b < numShort ? shortLen : shortLen + 1;
      const d = data.subarray(p, p + len);
      p += len;
      parts.push({ d, e: rsRemainder(d, nEcc) });
    }
    const cw = [];
    for (let i = 0; i < shortLen + 1; i++) for (const pt of parts) if (i < pt.d.length) cw.push(pt.d[i]);
    for (let i = 0; i < nEcc; i++) for (const pt of parts) cw.push(pt.e[i]);

    // Grid and function patterns.
    const size = ver * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };
    const finderAt = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const d = Math.max(Math.abs(i - 3), Math.abs(j - 3));
        set(rr, cc, d !== 2 && d !== 4);
      }
    };
    finderAt(0, 0);
    finderAt(0, size - 7);
    finderAt(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const pos = alignment(ver);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if (i === 0 && j === 0 || i === 0 && j === pos.length - 1 || i === pos.length - 1 && j === 0) continue;
        const r = pos[i], c = pos[j];
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) set(r + a, c + b, a === 0 && b === 0 || Math.max(Math.abs(a), Math.abs(b)) !== 1);
      }
    }
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const vbits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = (vbits >>> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
        set(a, b, !!bit);
        set(b, a, !!bit);
      }
    }

    // Format info: level L (01) + mask, BCH(15,5) code, mask 0x5412. Drawn as a
    // placeholder before data placement so its modules stay function modules.
    const formatBits = (mask) => {
      const d = 1 << 3 | mask; // L format bits = 01
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      return ((d << 10 | rem) ^ 0x5412) & 0x7fff;
    };
    const drawFormat = (mask) => {
      const b = formatBits(mask);
      const bit = (i) => (b >>> i) & 1;
      // First copy: wraps the top-left finder - up column 8 (bits 0-7), then
      // right along row 8 (bits 8-14, right to left).
      for (let i = 0; i <= 5; i++) set(i, 8, !!bit(i));
      set(7, 8, !!bit(6));
      set(8, 8, !!bit(7));
      set(8, 7, !!bit(8));
      for (let i = 9; i < 15; i++) set(8, 14 - i, !!bit(i));
      // Second copy: along row 8 near the top-right finder, then up column 8.
      for (let i = 0; i < 8; i++) set(8, size - 1 - i, !!bit(i));
      for (let i = 8; i < 15; i++) set(size - 15 + i, 8, !!bit(i));
      set(size - 8, 8, true); // the always-dark module
    };
    drawFormat(0); // placeholder: reserves the format modules

    // Data placement: two-column zigzag from the bottom right, skipping col 6.
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < cw.length * 8) {
            m[y][x] = ((cw[bi >> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    const penalty = () => {
      let p = 0;
      for (let r = 0; r < size; r++) {
        let run = 1;
        for (let c = 1; c <= size; c++) {
          if (c < size && m[r][c] === m[r][c - 1]) run++;
          else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
      }
      for (let c = 0; c < size; c++) {
        let run = 1;
        for (let r = 1; r <= size; r++) {
          if (r < size && m[r][c] === m[r - 1][c]) run++;
          else { if (run >= 5) p += 3 + run - 5; run = 1; }
        }
      }
      for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
        if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
      }
      const pat = (i, get) => {
        let a = 0;
        for (let k = 0; k < 10; k++) a = (a << 1) | (get(i + k) ? 1 : 0);
        return a === 0x2e8 || a === 0x5d; // 1011101000 and its reverse: a finder pattern with light beside it
      };
      for (let r = 0; r < size; r++) for (let c = 0; c <= size - 10; c++) if (pat(c, (k) => m[r][k])) p += 40;
      for (let c = 0; c < size; c++) for (let r = 0; r <= size - 10; r++) if (pat(r, (k) => m[k][c])) p += 40;
      let dark = 0;
      for (const row of m) for (const v of row) if (v) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    const applyMask = (mask) => {
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && maskFn[mask](r, c)) m[r][c] = !m[r][c];
    };

    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) {
      drawFormat(k);
      applyMask(k);
      const p = penalty();
      if (p < bestP) { bestP = p; best = k; }
      applyMask(k);
    }
    drawFormat(best);
    applyMask(best);
    return m;
  }

  function draw(canvas, text, scale) {
    const m = matrix(text);
    if (!m) { canvas.width = canvas.height = 0; return false; }
    scale = scale || 4;
    canvas.width = (m[0].length + 8) * scale;
    canvas.height = (m.length + 8) * scale;
    const x = canvas.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, canvas.width, canvas.height);
    x.fillStyle = '#000';
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) x.fillRect((4 + c) * scale, (4 + r) * scale, scale, scale);
      }
    }
    return true;
  }
  return { matrix, draw, SCALE: 4, QUIET: 4 };
})();
