'use strict';
/* Photoset Darkroom - minimal PDF writer. First-party, zero dependencies.
   PDF 1.4 with A4 portrait pages by default. A page embeds JPEG images with
   DCTDecode (bytes pass through, never recompressed) and draws text in the
   standard Helvetica core fonts. Text is ASCII: parentheses, backslashes and
   everything above ASCII 126 get escaped or degraded so the output stays
   byte-clean. The file ends with a plain xref table, trailer and %%EOF. */
const Pdf = (() => {
  // A4 portrait in PDF points (1/72 in).
  const A4 = { width: 595.28, height: 841.89 };

  // PDF string literals: escape the backslash and both parentheses; anything
  // the core fonts cannot show degrades to '?'.
  function escText(str) {
    let out = '';
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      if (c > 126) out += '?';
      else if (ch === '\\' || ch === '(' || ch === ')') out += '\\' + ch;
      else out += ch;
    }
    return out;
  }

  // Content-stream numbers: two decimals at most, never exponent notation.
  const num = (n) => String(Math.round(n * 100) / 100);

  function document(pageSize) {
    const size = pageSize || A4;
    const pages = [];
    return {
      size,
      pages,
      page() {
        const p = { ops: [], images: [] };
        pages.push(p);
        return {
          // bytes: a complete JPEG file; w/h its pixel dimensions; (x, y) the
          // lower-left corner and (rw, rh) the drawn size, all in points.
          jpeg(bytes, w, h, x, y, rw, rh) {
            const name = 'Im' + (p.images.length + 1);
            p.images.push({ name, bytes, w, h });
            p.ops.push(`q ${num(rw)} 0 0 ${num(rh)} ${num(x)} ${num(y)} cm /${name} Do Q`);
          },
          // opts: { size, bold, gray } with gray 0..1 (0 is black).
          text(str, x, y, opts) {
            const o = opts || {};
            const gray = o.gray != null ? `${num(o.gray)} g` : '0 g';
            const font = o.bold ? 'F2' : 'F1';
            p.ops.push(`BT ${gray} /${font} ${num(o.size || 10)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm (${escText(str)}) Tj ET`);
          },
          // A filled rectangle; gray 0..1. Cheap separators and rules.
          rect(x, y, w, h, gray) {
            p.ops.push(`${num(gray)} g ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f 0 g`);
          },
        };
      },
      end() {
        return serialize(pages, size);
      },
    };
  }

  function serialize(pages, size) {
    const enc = new TextEncoder();
    const ascii = (s) => enc.encode(s);
    const chunks = [];
    let offset = 0;
    const offsets = [];
    // An object: dict, then optionally a stream payload (bytes or text).
    const emit = (n, dict, payload) => {
      offsets[n] = offset;
      const parts = [ascii(`${n} 0 obj\n${dict}\n`)];
      if (payload) {
        const bytes = typeof payload === 'string' ? ascii(payload) : payload;
        parts.push(ascii(`stream\n`), bytes, ascii(`\nendstream\n`));
      }
      parts.push(ascii(`endobj\n`));
      for (const c of parts) { chunks.push(c); offset += c.length; }
    };

    push(new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
      0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // binary comment line
    ]));
    function push(chunk) { chunks.push(chunk); offset += chunk.length; }

    // Object 1 is the catalog, 2 the page tree, 3-4 the core fonts; every
    // page then takes a page object, a content stream and its image objects.
    const font = (name) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
    emit(1, '<< /Type /Catalog /Pages 2 0 R >>');
    emit(3, font('Helvetica'));
    emit(4, font('Helvetica-Bold'));
    let run = 5;
    const pageNumbers = pages.map((p) => {
      const pn = { page: run, content: run + 1, images: [] };
      run += 2;
      for (const im of p.images) { pn.images.push({ num: run, im }); run++; }
      return pn;
    });
    emit(2, `<< /Type /Pages /Kids [${pageNumbers.map((pn) => `${pn.page} 0 R`).join(' ')}] /Count ${pages.length} >>`);

    pages.forEach((p, i) => {
      const pn = pageNumbers[i];
      const xobj = pn.images.length
        ? ` /XObject << ${pn.images.map((e) => `/${e.im.name} ${e.num} 0 R`).join(' ')} >>`
        : '';
      emit(pn.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(size.width)} ${num(size.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobj} >> /Contents ${pn.content} 0 R >>`);
      const ops = p.ops.join('\n');
      emit(pn.content, `<< /Length ${ops.length} >>`, ops);
      for (const e of pn.images) {
        emit(e.num, `<< /Type /XObject /Subtype /Image /Width ${e.im.w} /Height ${e.im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${e.im.bytes.length} >>`, e.im.bytes);
      }
    });

    const maxObj = run - 1;
    const xrefAt = offset;
    const rows = ['xref', `0 ${maxObj + 1}`, '0000000000 65535 f '];
    for (let n = 1; n <= maxObj; n++) {
      rows.push(`${String(offsets[n]).padStart(10, '0')} 00000 n `);
    }
    rows.push('trailer', `<< /Size ${maxObj + 1} /Root 1 0 R >>`, 'startxref', String(xrefAt), '%%EOF');
    push(ascii(rows.join('\n')));
    return concat(chunks);
  }

  function concat(chunks) {
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  return { A4, escText, document };
})();
