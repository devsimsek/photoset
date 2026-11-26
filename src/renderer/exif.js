'use strict';
/* Minimal EXIF writer. Canvas re-encodes strips every marker, so when the
   photographer asks to keep EXIF, this writes the shot's story back into JPG
   output: one APP1 segment holding IFD0 (Make, Model, ModifyDate, sub-IFD
   pointers), the Exif IFD (DateTimeOriginal, ISO, ExposureTime, FNumber,
   LensMake, LensModel) and, only on the explicit GPS toggle, a GPS IFD with
   latitude and longitude. Fields the source lacks are skipped, never faked.
   Pure bytes, no dependencies. */
const Exif = (() => {
  function asciiDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}\0`;
  }

  const A = 2, S = 3, L = 4, R = 5; // TIFF field types: ASCII, SHORT, LONG, RATIONAL

  // Serialized as little-endian TIFF: three IFDs (IFD0, Exif, GPS), then the
  // values too big to sit inline (over 4 bytes) behind them. Returns null when
  // there is nothing at all to write.
  function tiff(e) {
    const u8 = (n) => new Uint8Array(n);
    const u16v = (n) => { const b = u8(2); new DataView(b.buffer).setUint16(0, n, true); return b; };
    const u32v = (n) => { const b = u8(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
    const str = (s) => { const b = u8(s.length + 1); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
    const rat = (n, d) => { const b = u8(8), v = new DataView(b.buffer); v.setUint32(0, n, true); v.setUint32(4, d, true); return b; };
    // Decimal degrees to degrees/minutes/seconds rationals (0.0001 s steps).
    const dms = (dec) => {
      const a = Math.abs(dec), dd = Math.floor(a), mm = Math.floor((a - dd) * 60);
      return [rat(dd, 1), rat(mm, 1), rat(Math.round(((a - dd) * 60 - mm) * 60 * 10000), 10000)];
    };
    const concat = (list) => {
      let n = 0; for (const b of list) n += b.length;
      const out = u8(n); let p = 0;
      for (const b of list) { out.set(b, p); p += b.length; }
      return out;
    };

    const ifds = [[], [], []];
    const put = (i, tag, type, count, val) => ifds[i].push({ tag, type, count, val });
    const s = e.date ? asciiDate(e.date) : null;
    if (e.make) put(0, 0x010f, A, e.make.length + 1, str(e.make));
    if (e.model) put(0, 0x0110, A, e.model.length + 1, str(e.model));
    if (s) { put(0, 0x0132, A, 20, str(s)); put(1, 0x9003, A, 20, str(s)); }
    if (e.lensMake) put(1, 0xa433, A, e.lensMake.length + 1, str(e.lensMake));
    if (e.lensModel) put(1, 0xa434, A, e.lensModel.length + 1, str(e.lensModel));
    if (e.iso) put(1, 0x8827, S, 1, u16v(e.iso));
    if (e.exposure) put(1, 0x829a, R, 1, rat(e.exposure[0], e.exposure[1]));
    if (e.fnumber) put(1, 0x829d, R, 1, rat(e.fnumber[0], e.fnumber[1]));
    if (e.gps) {
      put(2, 0x0001, A, 2, str(e.gps.latRef));
      put(2, 0x0002, R, 3, concat(dms(e.gps.lat)));
      put(2, 0x0003, A, 2, str(e.gps.lonRef));
      put(2, 0x0004, R, 3, concat(dms(e.gps.lon)));
    }
    if (ifds[1].length) ifds[0].push({ tag: 0x8769, type: L, count: 1, val: null, ptr: 1 });
    if (ifds[2].length) ifds[0].push({ tag: 0x8825, type: L, count: 1, val: null, ptr: 2 });
    if (!ifds[0].length) return null;
    for (const ifd of ifds) ifd.sort((a, b) => a.tag - b.tag);

    const sz = (ifd) => 2 + ifd.length * 12 + 4;
    const ext = (en) => (en.val && en.val.length > 4 ? en.val.length + (en.val.length & 1) : 0);
    const offs = [8, 8 + sz(ifds[0]), 8 + sz(ifds[0]) + sz(ifds[1])];
    const dataAt = offs[2] + sz(ifds[2]);
    let dataLen = 0;
    for (const ifd of ifds) for (const en of ifd) dataLen += ext(en);
    const buf = u8(dataAt + dataLen), v = new DataView(buf.buffer);
    buf.set([0x49, 0x49], 0); v.setUint16(2, 42, true); v.setUint32(4, 8, true);
    let p = 8;
    for (let i = 0; i < 3; i++) {
      const ifd = ifds[i];
      if (!ifd.length) continue;
      v.setUint16(p, ifd.length, true);
      let dp = dataAt;
      for (let j = 0; j < i; j++) for (const en of ifds[j]) dp += ext(en);
      let ep = p + 2;
      for (const en of ifd) {
        v.setUint16(ep, en.tag, true); v.setUint16(ep + 2, en.type, true); v.setUint32(ep + 4, en.count, true);
        if (en.val === null) v.setUint32(ep + 8, offs[en.ptr], true);
        else if (en.val.length <= 4) buf.set(en.val, ep + 8);
        else { v.setUint32(ep + 8, dp, true); buf.set(en.val, dp); dp += en.val.length + (en.val.length & 1); }
        ep += 12;
      }
      v.setUint32(ep, 0, true); // no next IFD
      p = ep + 4;
    }
    return buf;
  }

  function app1(t) {
    const seg = new Uint8Array(4 + 6 + t.length);
    const v = new DataView(seg.buffer);
    v.setUint16(0, 0xffe1);                    // APP1 marker
    v.setUint16(2, seg.length - 2);            // length counts itself, not the marker
    seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // 'Exif\0\0'
    seg.set(t, 10);
    return seg;
  }

  /** bytes: Uint8Array of a JPEG. exif: the shot's story {date, make, model,
      lensMake, lensModel, iso, exposure, fnumber, gps}, fields absent from the
      source left unset. withGps: the explicit GPS toggle; coordinates are never
      written without it. Returns a new Uint8Array with an EXIF APP1 inserted
      after SOI, or after APP0 when the encoder wrote one. Anything that is not
      a plain JPEG, or an empty story, goes back unchanged. */
  function stamp(bytes, exif, withGps) {
    if (!exif || bytes.length < 4) return bytes;
    const t = tiff(withGps ? exif : Object.assign({}, exif, { gps: null }));
    if (!t) return bytes;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint16(0) !== 0xffd8) return bytes;
    let at = 2;
    if (v.getUint16(2) === 0xffe0) at = 2 + 2 + v.getUint16(4);
    const seg = app1(t);
    const out = new Uint8Array(bytes.length + seg.length);
    out.set(bytes.subarray(0, at), 0);
    out.set(seg, at);
    out.set(bytes.subarray(at), at + seg.length);
    return out;
  }

  return { stamp };
})();
