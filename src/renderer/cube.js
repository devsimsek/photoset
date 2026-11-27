'use strict';
/* .cube LUT parser (ADR 0006). IRIDAS/Adobe Cube format, quoted from
   OpenColorIO's iridas reference: an optional TITLE, exactly one of
   LUT_3D_SIZE or LUT_1D_SIZE, optional DOMAIN_MIN/MAX and INPUT_RANGE lines,
   '#' comments and blank lines anywhere, and N^3 float triples in ascending
   index order with red changing most rapidly. Sizes 17..65 are accepted;
   everything else refuses with a message that names the problem. Text parses
   on the device; nothing uploads. */
const Cube = (() => {
  const triple = (text, what) => {
    const parts = String(text).trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const v = parts.map(Number);
    return v.every((x) => isFinite(x)) ? v : null;
  };

  function parse(text) {
    let title = null, size3 = null, size1 = null, dmin = null, dmax = null, range = null;
    const rows = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      let m;
      if ((m = line.match(/^TITLE\s+"(.*)"$/i))) { title = m[1]; continue; }
      if ((m = line.match(/^LUT_3D_SIZE\s+(\S+)$/i))) { size3 = m[1]; continue; }
      if ((m = line.match(/^LUT_1D_SIZE\s+(\S+)$/i))) { size1 = m[1]; continue; }
      if ((m = line.match(/^DOMAIN_MIN\s+(.+)$/i))) { dmin = m[1]; continue; }
      if ((m = line.match(/^DOMAIN_MAX\s+(.+)$/i))) { dmax = m[1]; continue; }
      if ((m = line.match(/^LUT_3D_INPUT_RANGE\s+(.+)$/i))) { range = m[1]; continue; }
      if ((m = line.match(/^LUT_1D_INPUT_RANGE\s+(.+)$/i))) { range = m[1]; continue; }
      rows.push(line);
    }
    if (size3 && size1) return { error: 'LUT_3D_SIZE and LUT_1D_SIZE cannot both be present' };
    if (size1) return { error: '1D cube files are not supported; this app takes 3D LUTs only' };
    if (!size3) return { error: 'no 3D table found: add a LUT_3D_SIZE line' };
    const size = Number(size3);
    if (!Number.isInteger(size) || size < 17 || size > 65) {
      return { error: `LUT_3D_SIZE ${size3} is out of range (17 to 65)` };
    }
    // A Log-input conversion LUT would clip the engine's sRGB frames to
    // garbage, so a non-default input domain refuses (ADR 0006 cut list).
    if (dmin !== undefined && dmin !== null) {
      const v = triple(dmin, 'DOMAIN_MIN');
      if (!v || v[0] !== 0 || v[1] !== 0 || v[2] !== 0) return { error: 'DOMAIN_MIN must be 0 0 0' };
    }
    if (dmax !== undefined && dmax !== null) {
      const v = triple(dmax, 'DOMAIN_MAX');
      if (!v || v[0] !== 1 || v[1] !== 1 || v[2] !== 1) return { error: 'DOMAIN_MAX must be 1 1 1' };
    }
    if (range !== undefined && range !== null) {
      const v = triple(range, 'input range');
      if (!v || v[0] !== 0 || v[1] !== 1) return { error: 'LUT_3D_INPUT_RANGE must be 0 1' };
    }
    const n = size * size * size;
    if (rows.length !== n) {
      return { error: `the table holds ${rows.length} rows, expected ${n} for size ${size}` };
    }
    const bytes = new Uint8Array(n * 3);
    for (let i = 0; i < rows.length; i++) {
      const parts = rows[i].split(/\s+/);
      if (parts.length !== 3) return { error: `table row ${i + 1} does not have three numbers` };
      const v = parts.map(Number);
      if (!v.every((x) => isFinite(x))) return { error: `table row ${i + 1} has a non-finite value` };
      // Clamp-then-quantise: each channel clamps to [0,1], then rounds half
      // up to the 8-bit output value the engine's write-clamp would hold.
      for (let c = 0; c < 3; c++) {
        const clamped = v[c] < 0 ? 0 : v[c] > 1 ? 1 : v[c];
        bytes[i * 3 + c] = Math.round(clamped * 255);
      }
    }
    // Rows arrive in red-fastest order, which is the film table's order too.
    return { title, size, table: encode(bytes) };
  }

  /** base64 of 8-bit table bytes -> Uint8Array. */
  function decode(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Uint8Array -> base64 (chunked so apply() stays in range; the chunk is a
      multiple of 3, so '=' padding never lands inside the string). */
  function encode(bytes) {
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 32766) {
      b64 += btoa(String.fromCharCode.apply(null, bytes.subarray(i, i + 32766)));
    }
    return b64;
  }

  return { parse, decode, encode };
})();
