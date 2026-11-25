'use strict';
/* Minimal EXIF writer. Canvas re-encodes strip every marker, so when the
   photographer asks to keep EXIF, this puts the capture date back into JPG
   output: one APP1 segment holding IFD0 (ModifyDate) and the Exif IFD
   (DateTimeOriginal). Pure bytes, no dependencies. */
const Exif = (() => {
  function asciiDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}\0`;
  }

  // 96-byte TIFF block: IFD0 (ModifyDate + ExifIFD pointer), Exif IFD
  // (DateTimeOriginal), then both 20-byte ASCII values.
  function tiff(date) {
    const s = asciiDate(date);
    const b = new Uint8Array(96);
    const v = new DataView(b.buffer);
    b.set([0x49, 0x49], 0);      // 'II', little-endian
    v.setUint16(2, 42, true);    // TIFF magic
    v.setUint32(4, 8, true);     // IFD0 starts right after the header
    v.setUint16(8, 2, true);     // IFD0: 2 entries
    v.setUint16(10, 0x0132, true); v.setUint16(12, 2, true); v.setUint32(14, 20, true); v.setUint32(18, 56, true); // ModifyDate
    v.setUint16(22, 0x8769, true); v.setUint16(24, 4, true); v.setUint32(26, 1, true); v.setUint32(30, 38, true); // ExifIFD pointer
    v.setUint32(34, 0, true);    // no next IFD
    v.setUint16(38, 1, true);    // Exif IFD: 1 entry
    v.setUint16(40, 0x9003, true); v.setUint16(42, 2, true); v.setUint32(44, 20, true); v.setUint32(48, 76, true); // DateTimeOriginal
    v.setUint32(52, 0, true);
    for (let i = 0; i < 20; i++) { b[56 + i] = s.charCodeAt(i); b[76 + i] = s.charCodeAt(i); }
    return b;
  }

  function app1(date) {
    const t = tiff(date);
    const seg = new Uint8Array(4 + 6 + t.length);
    const v = new DataView(seg.buffer);
    v.setUint16(0, 0xffe1);                    // APP1 marker
    v.setUint16(2, seg.length - 2);            // length counts itself, not the marker
    seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // 'Exif\0\0'
    seg.set(t, 10);
    return seg;
  }

  /** bytes: Uint8Array of a JPEG, date: Date. Returns a new Uint8Array with an
      EXIF APP1 inserted after SOI, or after APP0 when the encoder wrote one.
      Anything that is not a plain JPEG goes back unchanged. */
  function stamp(bytes, date) {
    if (!date || bytes.length < 4) return bytes;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint16(0) !== 0xffd8) return bytes;
    let at = 2;
    if (v.getUint16(2) === 0xffe0) at = 2 + 2 + v.getUint16(4);
    const seg = app1(date);
    const out = new Uint8Array(bytes.length + seg.length);
    out.set(bytes.subarray(0, at), 0);
    out.set(seg, at);
    out.set(bytes.subarray(at), at + seg.length);
    return out;
  }

  return { stamp };
})();
