'use strict';
/* Photoset Darkroom — image engine.
   Everything runs on canvas: crop → soften → colour grade → light leak → vignette → date stamp → grain → frame. */
const Engine = (() => {
  const ASPECTS = { orig: 0, '3:2': 1.5, '4:3': 4 / 3, '5:4': 1.25, '1:1': 1, '16:9': 16 / 9, cine: 2.39, instant: 62 / 46 };

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function seeded(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cropRect(W, H, aspect) {
    const r = ASPECTS[aspect];
    if (!r) return { x: 0, y: 0, w: W, h: H };
    const landscape = aspect === 'cine' ? true : W >= H;
    const t = landscape ? r : 1 / r;
    let cw = W, ch = W / t;
    if (ch > H) { ch = H; cw = H * t; }
    return { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch };
  }

  // ---------- colour ----------
  function hexRGB(h) { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hueOffset(hex, k) {
    const [r, g, b] = hexRGB(hex);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return [(r - l) * k, (g - l) * k, (b - l) * k];
  }
  function needsGrade(s) {
    return s.exposure || s.contrast || s.saturation || s.warmth || s.tint || s.fade || s.split || s.flicker;
  }

  function grade(ctx, w, h, s, rng) {
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const flick = s.flicker ? (rng() - 0.5) * (s.flicker / 100) * 0.6 : 0;
    const ev = Math.pow(2, s.exposure / 100 + flick);
    const c = 1 + (s.contrast / 100) * 0.9;
    const fade = (s.fade / 100) * 0.32;
    const gains = [1 + (s.warmth / 100) * 0.15, 1 - (s.tint / 100) * 0.1, 1 - (s.warmth / 100) * 0.15];
    const lut = [new Float32Array(256), new Float32Array(256), new Float32Array(256)];
    for (let ch = 0; ch < 3; ch++) {
      for (let i = 0; i < 256; i++) {
        let v = (i / 255) * ev;
        v = (v - 0.5) * c + 0.5;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        v *= gains[ch];
        v = fade + v * (1 - fade * 0.6);
        lut[ch][i] = v * 255;
      }
    }
    const sat = 1 + s.saturation / 100;
    const st = (s.split / 100) * 0.7;
    const so = hueOffset(s.shadow, st), ho = hueOffset(s.highlight, st);
    const lr = lut[0], lg = lut[1], lb = lut[2];
    for (let i = 0; i < d.length; i += 4) {
      let r = lr[d[i]], g = lg[d[i + 1]], b = lb[d[i + 2]];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (sat !== 1) { r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
      if (st) {
        const t = l / 255, ws = (1 - t) * (1 - t), wh = t * t;
        r += so[0] * ws + ho[0] * wh; g += so[1] * ws + ho[1] * wh; b += so[2] * ws + ho[2] * wh;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- optical effects ----------
  function lightLeak(ctx, w, h, amt, rng) {
    const L = Math.max(w, h), a = amt / 100;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const n = rng() < 0.6 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const left = rng() < 0.5;
      const x = left ? -L * 0.05 : w + L * 0.05;
      const y = h * (0.1 + rng() * 0.8);
      const r = L * (0.35 + rng() * 0.45);
      const col = rng() < 0.6 ? '255,96,24' : '255,40,70';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,232,180,${0.9 * a})`);
      g.addColorStop(0.25, `rgba(${col},${0.75 * a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function vignette(ctx, w, h, amt) {
    const R = Math.hypot(w, h) / 2, a = (amt / 100) * 0.9;
    const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.3, w / 2, h / 2, R);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(0,0,0,${a * 0.35})`);
    g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function grain(ctx, w, h, amt, size) {
    const L = Math.max(w, h), gs = Math.max(1, (size * L) / 1600);
    const nw = Math.max(1, Math.ceil(w / gs)), nh = Math.max(1, Math.ceil(h / gs));
    const n = mk(nw, nh), nx = n.getContext('2d');
    const id = nx.createImageData(nw, nh), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + (Math.random() + Math.random() - 1) * 140;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    nx.putImageData(id, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = Math.min(1, (amt / 100) * 0.6);
    ctx.imageSmoothingEnabled = gs > 1.5;
    ctx.drawImage(n, 0, 0, nw * gs, nh * gs);
    ctx.restore();
  }

  // ---------- seven-segment date stamp ----------
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function fmtDate(d, fmt) {
    const yy = String(d.getFullYear()).slice(-2);
    const m = d.getMonth() + 1, dd = d.getDate();
    const mm = m < 10 ? '_' + m : String(m);
    const ds = dd < 10 ? '_' + dd : String(dd);
    if (fmt === 'mdy') return `${mm} ${ds} '${yy}`;
    if (fmt === 'dmy') return `${ds} ${mm} '${yy}`;
    return `'${yy} ${mm} ${ds}`;
  }
  function dateStamp(ctx, w, h, date, fmt) {
    const str = fmtDate(date, fmt), S = Math.min(w, h);
    const dh = S * 0.05, dw = dh * 0.52, t = dh * 0.14, gap = t * 0.6, adv = dw + dh * 0.32;
    const advOf = (ch) => (ch === "'" ? dh * 0.3 : ch === ' ' ? dh * 0.38 : adv);
    let total = 0;
    for (const ch of str) total += advOf(ch);
    ctx.save();
    ctx.translate(w - S * 0.07 - total, h - S * 0.07 - dh);
    ctx.transform(1, 0, -0.1, 1, 0.1 * dh, 0);
    ctx.beginPath();
    const line = (x1, y1, x2, y2) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); };
    let x = 0;
    for (const ch of str) {
      if (ch === "'") line(x + dh * 0.1, 0, x + dh * 0.06, dh * 0.26);
      else if (SEG[ch]) {
        for (const sgm of SEG[ch]) {
          if (sgm === 'a') line(x + gap, 0, x + dw - gap, 0);
          if (sgm === 'b') line(x + dw, gap, x + dw, dh / 2 - gap);
          if (sgm === 'c') line(x + dw, dh / 2 + gap, x + dw, dh - gap);
          if (sgm === 'd') line(x + gap, dh, x + dw - gap, dh);
          if (sgm === 'e') line(x, dh / 2 + gap, x, dh - gap);
          if (sgm === 'f') line(x, gap, x, dh / 2 - gap);
          if (sgm === 'g') line(x + gap, dh / 2, x + dw - gap, dh / 2);
        }
      }
      x += advOf(ch);
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineWidth = t;
    ctx.strokeStyle = 'rgba(255,140,40,0.95)';
    ctx.shadowColor = 'rgba(255,80,10,1)';
    ctx.shadowBlur = dh * 0.45;
    ctx.stroke();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = t * 0.4;
    ctx.strokeStyle = 'rgba(255,222,170,0.85)';
    ctx.stroke();
    ctx.restore();
  }

  // ---------- main render ----------
  /** src: ImageBitmap or canvas. meta: {name, date}. edge: max long edge of output. */
  function renderLook(src, meta, s, edge, aspectOverride) {
    const cr = cropRect(src.width, src.height, aspectOverride || s.aspect);
    const outLong = Math.min(edge || Infinity, Math.max(cr.w, cr.h));
    const sc = outLong / Math.max(cr.w, cr.h);
    const w = Math.max(1, Math.round(cr.w * sc)), h = Math.max(1, Math.round(cr.h * sc));
    const c = mk(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const rng = seeded(hash(meta.name));
    const L = Math.max(w, h);

    const blur = (s.softness / 100) * L * 0.0028;
    if (blur > 0.15) {
      const p = blur * 2.5;
      ctx.filter = `blur(${blur.toFixed(2)}px)`;
      ctx.drawImage(src, cr.x, cr.y, cr.w, cr.h, -p, -p, w + 2 * p, h + 2 * p);
      ctx.filter = 'none';
    } else {
      ctx.drawImage(src, cr.x, cr.y, cr.w, cr.h, 0, 0, w, h);
    }
    if (needsGrade(s)) grade(ctx, w, h, s, rng);
    if (s.leak > 0) lightLeak(ctx, w, h, s.leak, rng);
    if (s.vignette > 0) vignette(ctx, w, h, s.vignette);
    if (s.date && meta.date) dateStamp(ctx, w, h, meta.date, s.dateFmt);
    if (s.grain > 0) grain(ctx, w, h, s.grain, s.grainSize);
    return c;
  }

  // ---------- frames ----------
  function composeStrip(frames, startNum) {
    const H = Math.max(...frames.map((f) => f.height));
    const ws = frames.map((f) => (f.width * H) / f.height);
    const band = H * 0.23, gap = H * 0.07, pad = gap;
    const W = Math.round(pad * 2 + ws.reduce((a, b) => a + b, 0) + gap * (frames.length - 1));
    const TH = Math.round(H + band * 2);
    const c = mk(W, TH), x = c.getContext('2d');
    x.fillStyle = '#14100c';
    x.fillRect(0, 0, W, TH);
    const sheen = x.createLinearGradient(0, 0, 0, TH);
    sheen.addColorStop(0, 'rgba(120,70,30,0.22)');
    sheen.addColorStop(0.5, 'rgba(0,0,0,0)');
    sheen.addColorStop(1, 'rgba(120,70,30,0.22)');
    x.fillStyle = sheen;
    x.fillRect(0, 0, W, TH);

    // sprocket holes
    const pitch = H * 0.198, pw = H * 0.117, ph = H * 0.0825, pr = ph * 0.25;
    x.fillStyle = '#f4f0e6';
    x.beginPath();
    for (let px = pitch * 0.3; px < W; px += pitch) {
      x.roundRect(px, band * 0.5 - ph / 2, pw, ph, pr);
      x.roundRect(px, TH - band * 0.5 - ph / 2, pw, ph, pr);
    }
    x.fill();

    // frames + edge print
    const fs = Math.max(8, band * 0.2);
    x.font = `700 ${fs}px Consolas, "Courier New", monospace`;
    x.textBaseline = 'middle';
    let px = pad;
    frames.forEach((f, i) => {
      x.save();
      x.beginPath();
      x.roundRect(px, band, ws[i], H, H * 0.012);
      x.clip();
      x.drawImage(f, px, band, ws[i], H);
      x.restore();
      const n = startNum + i;
      x.fillStyle = 'rgba(236,160,58,0.92)';
      x.textAlign = 'center';
      x.fillText(String(n), px + ws[i] / 2, TH - band * 0.13);
      if (i < frames.length - 1) x.fillText('▸' + n + 'A', px + ws[i] + gap / 2, TH - band * 0.13);
      x.textAlign = 'left';
      x.fillText(i % 2 ? '◂ SAFETY FILM' : 'PHOTOSET 400', px + ws[i] * 0.12, band * 0.13);
      px += ws[i] + gap;
    });
    return c;
  }

  function frameSuper8(f) {
    const w = f.width, h = f.height, S = Math.min(w, h);
    const side = S * 0.2, rp = S * 0.05, tb = S * 0.09;
    const W = Math.round(side + w + rp), H = Math.round(h + tb * 2);
    const c = mk(W, H), x = c.getContext('2d');
    x.fillStyle = '#0d0a08';
    x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(130,75,30,0.22)');
    g.addColorStop(0.18, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // neighbouring frames peeking in
    x.fillStyle = '#211a14';
    x.beginPath();
    x.roundRect(side, tb - h - tb * 0.9, w, h, S * 0.06);
    x.roundRect(side, tb + h + tb * 0.9, w, h, S * 0.06);
    x.fill();
    // perforation
    const pw = side * 0.38, ph = h * 0.2;
    x.fillStyle = '#f3eee2';
    x.beginPath();
    x.roundRect(side * 0.3, H / 2 - ph / 2, pw, ph, pw * 0.25);
    x.fill();
    // rounded gate
    x.save();
    x.beginPath();
    x.roundRect(side, tb, w, h, S * 0.06);
    x.clip();
    x.drawImage(f, side, tb);
    x.shadowColor = 'rgba(0,0,0,0.85)';
    x.shadowBlur = S * 0.035;
    x.lineWidth = S * 0.02;
    x.strokeStyle = '#000';
    x.beginPath();
    x.roundRect(side - S * 0.01, tb - S * 0.01, w + S * 0.02, h + S * 0.02, S * 0.065);
    x.stroke();
    x.restore();
    // edge marking
    x.save();
    x.translate(side * 0.5, H * 0.84);
    x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(236,160,58,0.85)';
    x.font = `700 ${Math.max(8, side * 0.17)}px Consolas, monospace`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('S8 · 50D', 0, 0);
    x.restore();
    return c;
  }

  function frameInstant(f) {
    const w = f.width, h = f.height, S = Math.min(w, h), portrait = h > w;
    const side = S * 0.087, top = S * 0.12, bot = S * (portrait ? 0.36 : 0.28);
    const W = Math.round(w + side * 2), H = Math.round(h + top + bot);
    const c = mk(W, H), x = c.getContext('2d');
    x.fillStyle = '#f4f0e6';
    x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(190,178,155,0.2)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    grain(x, W, H, 10, 1.2);
    x.drawImage(f, side, top);
    x.save();
    x.beginPath();
    x.rect(side, top, w, h);
    x.clip();
    x.shadowColor = 'rgba(0,0,0,0.5)';
    x.shadowBlur = S * 0.012;
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    x.lineWidth = S * 0.006;
    x.strokeRect(side - S * 0.003, top - S * 0.003, w + S * 0.006, h + S * 0.006);
    x.restore();
    return c;
  }

  function applyFrame(c, s, index) {
    if (s.frame === '35mm') return composeStrip([c], index + 1);
    if (s.frame === 'super8') return frameSuper8(c);
    if (s.frame === 'instant') return frameInstant(c);
    return c;
  }

  /** format: 'image/jpeg' (default), 'image/webp' or 'image/png'. */
  function encode(canvas, quality, format) {
    format = format || 'image/jpeg';
    return new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('Encode failed: ' + format))), format, quality / 100));
  }

  // ---------- EXIF capture date ----------
  async function exifDate(blob) {
    try {
      const buf = await blob.slice(0, 196608).arrayBuffer();
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return null;
      let o = 2;
      while (o + 4 < v.byteLength) {
        const m = v.getUint16(o);
        if ((m & 0xff00) !== 0xff00) break;
        const len = v.getUint16(o + 2);
        if (m === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
          const t = o + 10, le = v.getUint16(t) === 0x4949;
          const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
          const ifd = (off) => {
            const n = u16(t + off), tags = {};
            for (let i = 0; i < n; i++) { const e = t + off + 2 + i * 12; tags[u16(e)] = { count: u32(e + 4), at: e + 8 }; }
            return tags;
          };
          const str = (tag) => {
            const at = tag.count > 4 ? t + u32(tag.at) : tag.at;
            let s = '';
            for (let i = 0; i < Math.min(tag.count - 1, 32); i++) s += String.fromCharCode(v.getUint8(at + i));
            return s;
          };
          const ifd0 = ifd(u32(t + 4));
          let s = null;
          if (ifd0[0x8769]) { const ex = ifd(u32(ifd0[0x8769].at)); if (ex[0x9003]) s = str(ex[0x9003]); }
          if (!s && ifd0[0x0132]) s = str(ifd0[0x0132]);
          const mm = s && s.match(/(\d{4}):(\d{2}):(\d{2})/);
          return mm ? new Date(+mm[1], +mm[2] - 1, +mm[3]) : null;
        }
        o += 2 + len;
      }
    } catch { /* no usable EXIF */ }
    return null;
  }

  return { renderLook, applyFrame, composeStrip, encode, exifDate, mk };
})();
