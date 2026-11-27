'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const PREV_EDGE = 1600;       // long edge of cached preview sources
  const STRIP_PREV_EDGE = 720;  // per-frame long edge in strip previews

  // ---------- bridge: window.api, defined by web-api.js ----------
  const api = window.api;
  const isWeb = api.kind === 'web';

  // ---------- film stocks ----------
  const BASE = {
    exposure: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0, fade: 0,
    split: 0, shadow: '#2f6a72', highlight: '#ffb46a',
    grain: 0, grainSize: 1.5, vignette: 0, softness: 0, leak: 0, flicker: 0,
    halation: 0, // optional look key (PS-52): the default every film without it gets
    aspect: 'orig', frame: 'none', date: false, rotate: 0,
  };
  const LOOK_KEYS = Object.keys(BASE);
  const OUTPUT_DEFAULTS = { quality: 72, maxEdge: 0, capKB: 0, mode: 'single', stripN: 4, folder: 'developed', dateFmt: 'ymd', format: 'image/jpeg', keepExif: false, gpsExif: false };
  const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

  const STOCKS = [
    { id: 'natural', name: 'Clean\nScan', iso: 'RAW', c1: '#d8d2c4', c2: '#8a8f94', look: {} },
    { id: 'disposable', name: 'Drugstore\nDisposable', iso: '400', c1: '#f2c230', c2: '#1f8a4c',
      look: { exposure: 10, contrast: 18, saturation: 18, warmth: 14, tint: 4, fade: 8, split: 25, shadow: '#3a6b5a', highlight: '#ffb070', grain: 35, grainSize: 1.6, vignette: 40, softness: 15, date: true } },
    { id: 'super8', name: 'Super 8\nHome Movie', iso: '50D', c1: '#e8432a', c2: '#f2c230', ink: '#fff4e0',
      look: { exposure: 5, contrast: 10, saturation: -5, warmth: 28, tint: 6, fade: 22, split: 30, shadow: '#5a3a2a', highlight: '#ffd08a', grain: 70, grainSize: 2.6, vignette: 65, softness: 45, leak: 35, flicker: 40, aspect: '4:3', frame: 'super8' } },
    { id: 'instant', name: 'Instant\nMini', iso: '800', c1: '#f4efe3', c2: '#58b8c4',
      look: { exposure: 12, contrast: -12, saturation: -10, warmth: -4, tint: -6, fade: 30, split: 35, shadow: '#2f6f7a', highlight: '#fff0c8', grain: 12, grainSize: 1.2, vignette: 20, softness: 20, aspect: 'instant', frame: 'instant' } },
    { id: 'cine', name: 'Cine Reel\n35', iso: '500T', c1: '#2a2f5c', c2: '#ff7a1a', ink: '#efe4cc',
      look: { contrast: 22, saturation: 5, warmth: 6, fade: 10, split: 45, shadow: '#1f6f78', highlight: '#ffab5e', grain: 30, grainSize: 1.8, vignette: 35, softness: 10, leak: 10, aspect: '3:2', frame: '35mm' } },
    { id: 'golden', name: 'Golden\nSummer', iso: '200', c1: '#ff9f1c', c2: '#c2381b',
      look: { exposure: 6, contrast: 12, saturation: 22, warmth: 30, tint: 3, fade: 12, split: 30, shadow: '#6a4a2a', highlight: '#ffc36a', grain: 28, grainSize: 1.5, vignette: 30, softness: 10, leak: 15 } },
    { id: 'expired', name: "Expired\n'89", iso: '200', c1: '#b8487a', c2: '#f6d365', ink: '#fff4e0',
      look: { exposure: 8, contrast: -8, saturation: -20, warmth: 10, tint: 22, fade: 35, split: 40, shadow: '#5a2a6a', highlight: '#ffe08a', grain: 55, grainSize: 2, vignette: 45, softness: 20, leak: 55, date: true } },
    { id: 'flash', name: 'Party\nFlash', iso: '1600', c1: '#2b6fd6', c2: '#f2c230', ink: '#ffffff',
      look: { exposure: 18, contrast: 30, saturation: 10, warmth: -6, tint: -4, fade: 4, split: 30, shadow: '#1d3d6a', highlight: '#fff2d8', grain: 45, grainSize: 1.4, vignette: 60, softness: 8, date: true } },
    { id: 'mono', name: 'Tri-Mono\nB&W', iso: '400', c1: '#1b1b1b', c2: '#efe4cc', ink: '#efe4cc',
      look: { saturation: -100, contrast: 28, fade: 6, grain: 55, grainSize: 1.8, vignette: 35, softness: 5, aspect: '3:2', frame: '35mm' } },
  ];

  const SLIDERS = [
    ['exposure', 'Exposure', -100, 100, 1], ['contrast', 'Contrast', -60, 60, 1], ['saturation', 'Saturation', -100, 80, 1],
    ['warmth', 'Warmth', -60, 60, 1], ['tint', 'Tint', -60, 60, 1], ['fade', 'Fade', 0, 60, 1], ['split', 'Split tone', 0, 100, 1],
    ['grain', 'Grain', 0, 100, 1], ['grainSize', 'Grain size', 1, 4, 0.1], ['vignette', 'Vignette', 0, 100, 1],
    ['softness', 'Softness', 0, 100, 1], ['leak', 'Light leak', 0, 100, 1], ['flicker', 'Flicker', 0, 100, 1],
  ];

  // ---------- films (schema v1) ----------
  const LOOK_FIELDS = [
    'exposure', 'contrast', 'saturation', 'warmth', 'tint', 'fade', 'split',
    'shadow', 'highlight', 'grain', 'grainSize', 'vignette', 'softness',
    'leak', 'flicker', 'aspect', 'frame', 'date', 'dateFmt', 'rotate',
  ];
  // rotate: OPTIONAL schema v1 look key, default 0; old films still validate.
  const ROTS = [0, 90, 180, 270];
  const FRAMES = ['none', '35mm', 'super8', 'instant', 'halfframe', 'sprocket'];
  const DATE_FMTS = ['ymd', 'mdy', 'dmy'];
  const HEX = /^#[0-9a-f]{6}$/i;
  const films = loadFilms();
  function loadFilms() {
    try {
      const arr = JSON.parse(localStorage.getItem('darkroom.films') || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.filter((f) => validateFilm(f) === null);
    } catch { return []; }
  }
  function persistFilms() {
    try { localStorage.setItem('darkroom.films', JSON.stringify(films)); } catch { /* ignore */ }
  }

  // ---------- state ----------
  const state = {
    roll: null, photos: [], sel: -1,
    picks: [], // photo indices in the order they were picked; empty = use the whole roll
    stripHigh: 0, // highest strip_NNN handed to output; remembered across reloads
    perPhoto: {}, // name -> per-photo look overrides (reserved; nothing edits them yet)
    s: { ...BASE, ...OUTPUT_DEFAULTS },
    stock: 'natural', custom: false, busy: false, lastOut: null, rollToken: 0,
  };
  try {
    const saved = JSON.parse(localStorage.getItem('darkroom.settings') || 'null');
    if (saved && saved.s) {
      for (const k of Object.keys(state.s)) if (typeof saved.s[k] === typeof state.s[k]) state.s[k] = saved.s[k];
      // stockById lives further down; look the stock up inline so the saved
      // film stock survives the reload instead of dying in a swallowed TDZ
      // error (this block used to restore sliders only).
      const savedStock = STOCKS.find((x) => x.id === saved.stock) || films.find((f) => f.id === saved.stock);
      if (savedStock) state.stock = saved.stock;
      state.custom = !!saved.custom;
    }
  } catch { /* first run */ }
  {
    const active = films.find((f) => f.id === state.stock);
    if (active) { Object.assign(state.s, BASE, active.look); state.custom = true; }
  }
  function persist() {
    try { localStorage.setItem('darkroom.settings', JSON.stringify({ s: state.s, stock: state.stock, custom: state.custom })); } catch { /* ignore */ }
  }

  // ---------- roll memory (metadata only, pixels never) ----------
  // darkroom.roll: names, sizes, mtimes, EXIF dates, picks, strip high-water mark. Pixels never.
  const ROLL_KEY = 'darkroom.roll';

  function rememberedMeta() {
    try {
      const meta = JSON.parse(localStorage.getItem(ROLL_KEY) || 'null');
      if (!meta || meta.schema !== 1 || !Array.isArray(meta.photos)) return null;
      return meta;
    } catch { return null; }
  }

  function rollSnapshot() {
    if (!state.roll) return null;
    return {
      schema: 1,
      name: state.roll.name,
      savedAt: Date.now(),
      photos: state.photos.map((p) => ({
        name: p.name, size: p.size, mtime: p.mtime,
        ...(p.date ? { date: p.date.toISOString() } : {}),
        ...(p.missing ? { missing: true } : {}),
      })),
      picks: state.picks.map((i) => (state.photos[i] || {}).name).filter(Boolean),
      perPhoto: state.perPhoto || {},
      stripHigh: state.stripHigh || 0,
    };
  }

  function persistRoll() {
    if (state.photos.some((p) => p.remembered)) return; // a remembered context stores nothing new
    try {
      const snap = rollSnapshot();
      if (snap) localStorage.setItem(ROLL_KEY, JSON.stringify(snap));
    } catch { /* storage blocked or full: memory is best effort */ }
  }

  function showRememberedRoll() {
    const meta = rememberedMeta();
    if (!meta || !meta.photos.length) return;
    state.roll = { name: meta.name || 'remembered roll', dir: null, files: [] };
    state.photos = meta.photos.map((m, i) => ({
      name: m.name, size: m.size || 0, mtime: m.mtime || 0,
      date: m.date ? new Date(m.date) : null,
      idx: i, w: 0, h: 0, thumb: null, out: null, remembered: true,
    }));
    state.stripHigh = meta.stripHigh || 0;
    state.perPhoto = meta.perPhoto || {};
    buildRollList();
    updateHeader();
    updateDevNote();
    $('#empty').hidden = true;
    $('#rememberBanner').hidden = false;
    updatePickUI();
  }

  // ---------- films: export, validation, import, library ----------
  const singleLine = (s) => String(s).replace(/\s+/g, ' ').trim();
  const slugify = (s) => singleLine(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'film';
  const stockById = (id) => STOCKS.find((x) => x.id === id) || films.find((f) => f.id === id) || null;
  const activeFilm = () => films.find((f) => f.id === state.stock) || null;
  // The active film's LUT, or null when the active stock carries none. The
  // LUT lives on the film, never on the look: the look stays byte-for-byte
  // the documented v1 contract and the settings persistence stays small.
  const activeLut = () => { const f = activeFilm(); return (f && f.lut) || null; };
  function uniqueId(base, taken) {
    let id = base, n = 2;
    while (taken.some((x) => x.id === id)) id = `${base}-${n++}`;
    return id;
  }
  // The look snapshot exports the required fields always; halation rides
  // along only when it is non-zero, so films written without the key stay
  // byte-identical to the films this build exported before it (PS-52).
  const lookSnapshot = () => {
    const look = {};
    for (const k of LOOK_FIELDS) look[k] = state.s[k];
    if (state.s.halation) look.halation = state.s.halation;
    return look;
  };
  function exportFilm() {
    const st = stockById(state.stock);
    const name = st ? singleLine(st.name) : 'Custom film';
    let base = slugify(name);
    if (state.custom && STOCKS.some((x) => x.id === base)) base += '-custom'; // never a built-in's id
    const lut = activeLut();
    const film = { schema: lut ? 2 : 1, id: uniqueId(base, films), name, iso: st ? String(st.iso) : 'CUSTOM', look: lookSnapshot() };
    if (lut) film.lut = lut;
    return film;
  }
  function applyFilm(film) {
    Object.assign(state.s, BASE, film.look);
    state.stock = film.id;
    state.custom = true;
    syncControls();
    changed('look');
  }
  // Returns an error message, or null when the film is a valid film.
  // Schema 1 imports exactly as it always did; schema 2 is schema 1 grown at
  // the root with an optional lut { name, size, table } (ADR 0006): the table
  // is base64 of exactly size^3 x 3 bytes, each byte an 8-bit output value in
  // red-fastest order.
  function validateFilm(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'this is not a film JSON';
    if (raw.schema !== 1 && raw.schema !== 2) {
      return `unknown film schema version ${JSON.stringify(raw.schema)} (expected 1 or 2)`;
    }
    for (const k of ['id', 'name']) if (typeof raw[k] !== 'string' || !raw[k].trim()) return `film ${k} is missing`;
    if (typeof raw.iso !== 'string') return 'film iso must be text';
    const look = raw.look;
    if (!look || typeof look !== 'object' || Array.isArray(look)) return 'film look is missing';
    for (const k of Object.keys(look)) if (!LOOK_FIELDS.includes(k) && k !== 'halation') return `unknown look key "${k}"`;
    for (const k of LOOK_FIELDS) if (!(k in look) && k !== 'rotate') return `look is missing "${k}"`;
    if ('rotate' in look && !ROTS.includes(look.rotate)) {
      return `unknown rotate ${JSON.stringify(look.rotate)} (use 0, 90, 180 or 270)`;
    }
    // halation: OPTIONAL schema v1 look key, default 0 (PS-52); films written
    // before the key existed import unchanged.
    if ('halation' in look) {
      if (typeof look.halation !== 'number' || !isFinite(look.halation)) return 'halation must be a number';
      if (look.halation < 0 || look.halation > 100) return `halation ${look.halation} is out of range (0 to 100)`;
    }
    for (const [k, , min, max] of SLIDERS) {
      const v = look[k];
      if (typeof v !== 'number' || !isFinite(v)) return `${k} must be a number`;
      if (v < min || v > max) return `${k} ${v} is out of range (${min} to ${max})`;
    }
    for (const k of ['shadow', 'highlight']) if (!HEX.test(look[k])) return `${k} must be a #rrggbb colour`;
    if (!(look.aspect in Engine.ASPECTS)) return `unknown aspect "${look.aspect}"`;
    if (!FRAMES.includes(look.frame)) return `unknown frame "${look.frame}"`;
    if (typeof look.date !== 'boolean') return 'date must be on or off';
    if (!DATE_FMTS.includes(look.dateFmt)) return `unknown date format "${look.dateFmt}"`;
    if (raw.schema === 2 && raw.lut !== undefined) {
      const err = validateLut(raw.lut);
      if (err) return err;
    }
    return null;
  }
  function validateLut(lut) {
    if (!lut || typeof lut !== 'object' || Array.isArray(lut)) return 'film lut is malformed';
    if (typeof lut.name !== 'string' || !lut.name.trim()) return 'lut name is missing';
    if (typeof lut.size !== 'number' || !isFinite(lut.size) || Math.floor(lut.size) !== lut.size ||
        lut.size < 17 || lut.size > 65) {
      return `lut size ${JSON.stringify(lut.size)} is out of range (17 to 65)`;
    }
    const expected = lut.size * lut.size * lut.size * 3;
    let bytes;
    try { bytes = atob(lut.table); } catch { return 'lut table is not valid base64'; }
    if (bytes.length !== expected) {
      return `lut table must be base64 of ${expected} bytes (${lut.size}x${lut.size}x${lut.size}x3), got ${bytes.length}`;
    }
    return null;
  }
  // A film carrying a LUT travels as a downloaded file only (ADR 0006): the
  // QR and the paste surfaces refuse with a named message; the file path and
  // the library take it as-is.
  const lutPasteCap = 'a LUT film is too heavy to paste; import the downloaded file';
  const lutQrCap = 'a LUT film is too heavy for QR; share the downloaded file';
  function importFilm(text, fromFile) {
    let raw;
    try { raw = JSON.parse(text); } catch { return { error: 'this is not JSON' }; }
    const err = validateFilm(raw);
    if (err) return { error: err };
    const lut = raw.schema === 2 && raw.lut ? raw.lut : null;
    if (lut && !fromFile) return { error: lutPasteCap };
    const film = { schema: raw.schema, id: String(raw.id).trim(), name: raw.name, iso: raw.iso, look: raw.look };
    if (lut) film.lut = lut;
    const at = films.findIndex((f) => f.id === film.id);
    if (at >= 0) films[at] = film; // the same film updates in place
    else films.push(film);
    persistFilms();
    buildStocks();
    applyFilm(film);
    return { film };
  }
  // A LUT film built from a .cube file (PS-45): the parsed table becomes the
  // film's lut, the look stays at the neutral defaults, and the TITLE (or the
  // file name) names the film.
  function importCube(text, filename) {
    const r = Cube.parse(text);
    if (r.error) return { error: r.error };
    const name = singleLine(r.title || String(filename || '').replace(/\.cube$/i, '')) || 'Imported LUT';
    const film = {
      schema: 2, id: uniqueId(slugify(name), films), name, iso: 'CUBE',
      look: { ...BASE }, lut: { name, size: r.size, table: r.table },
    };
    const at = films.findIndex((f) => f.id === film.id);
    if (at >= 0) films[at] = film;
    else films.push(film);
    persistFilms();
    buildStocks();
    applyFilm(film);
    return { film };
  }
  // ---------- .cube export (PS-46) ----------
  // The film's look baked into a 33-point .cube: the grade function G is
  // evaluated at every lattice point in engine order (per-channel curve by
  // linear interpolation at the fractional input, then saturation toward the
  // curved luma, then split-tone with (1-t)^2 / t^2 weights, t = luma/255),
  // quantised the way the engine's write-clamp would, and for a film that
  // carries a LUT the film's own table is sampled at that byte with the same
  // arithmetic the engine's lut pass uses, so the bake is grade-then-LUT in
  // pipeline order. Flicker, leak, vignette, softness, grain and the frame
  // are optical-stack steps a colour cube cannot carry, so they stay out.
  const CUBE_N = 33;
  function bakeCube(film) {
    const look = film.look;
    const curves = Engine.curveLUT(look, 0); // flicker is per-shot, never baked
    const sat = 1 + look.saturation / 100;
    const st = (look.split / 100) * 0.7;
    const so = st ? Engine.hueOffset(look.shadow, st) : null;
    const ho = st ? Engine.hueOffset(look.highlight, st) : null;
    const lut = film.lut ? Cube.decode(film.lut.table) : null;
    const NS = film.lut ? film.lut.size : 0;
    const N1 = CUBE_N - 1;
    const quantise = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v)); // the 8-bit write-clamp
    const bytes = new Uint8Array(CUBE_N * CUBE_N * CUBE_N * 3);
    let k = 0;
    for (let b = 0; b < CUBE_N; b++) {
      for (let g = 0; g < CUBE_N; g++) {
        for (let r = 0; r < CUBE_N; r++) {
          let R = Engine.curveAt(curves[0], r * 255 / N1);
          let G = Engine.curveAt(curves[1], g * 255 / N1);
          let B = Engine.curveAt(curves[2], b * 255 / N1);
          const l = 0.299 * R + 0.587 * G + 0.114 * B;
          if (sat !== 1) { R = l + (R - l) * sat; G = l + (G - l) * sat; B = l + (B - l) * sat; }
          if (st) {
            const t = l / 255, ws = (1 - t) * (1 - t), wh = t * t;
            R += so[0] * ws + ho[0] * wh; G += so[1] * ws + ho[1] * wh; B += so[2] * ws + ho[2] * wh;
          }
          R = quantise(R); G = quantise(G); B = quantise(B);
          if (lut) {
            // Mirrors the engine lutPass arithmetic exactly (red, then green,
            // then blue) so the baked lattice point reproduces the pipeline.
            const x = R * (NS - 1) / 255, y = G * (NS - 1) / 255, z = B * (NS - 1) / 255;
            const r0 = Math.floor(x), g0 = Math.floor(y), b0 = Math.floor(z);
            const rx = x - r0, gx = y - g0, bz = z - b0;
            const r1 = r0 < NS - 1 ? r0 + 1 : NS - 1, g1 = g0 < NS - 1 ? g0 + 1 : NS - 1, b1 = b0 < NS - 1 ? b0 + 1 : NS - 1;
            const o = ((b0 * NS + g0) * NS + r0) * 3;
            const dr = (r1 - r0) * 3, dgy = (g1 - g0) * NS * 3, dbz = (b1 - b0) * NS * NS * 3;
            const L = (a, f, c) => a + (c - a) * f;
            const out = [R, G, B];
            for (let ch = 0; ch < 3; ch++) {
              const top = L(L(lut[o + ch], rx, lut[o + dr + ch]), gx, L(lut[o + dgy + ch], rx, lut[o + dgy + dr + ch]));
              const bottom = L(L(lut[o + dbz + ch], rx, lut[o + dbz + dr + ch]), gx, L(lut[o + dbz + dgy + ch], rx, lut[o + dbz + dgy + dr + ch]));
              out[ch] = quantise(L(top, bz, bottom));
            }
            R = out[0]; G = out[1]; B = out[2];
          }
          bytes[k++] = R; bytes[k++] = G; bytes[k++] = B;
        }
      }
    }
    // 6-decimal floats (OCIO bakes at the same precision), red fastest,
    // explicit DOMAIN lines, TITLE from the film name.
    const title = singleLine(film.name).replace(/"/g, "'");
    const lines = [`TITLE "${title}"`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0', `LUT_3D_SIZE ${CUBE_N}`];
    for (let i = 0; i < bytes.length; i += 3) {
      lines.push(`${(bytes[i] / 255).toFixed(6)} ${(bytes[i + 1] / 255).toFixed(6)} ${(bytes[i + 2] / 255).toFixed(6)}`);
    }
    return lines.join('\n') + '\n';
  }

  function saveFilm(name, iso) {
    const film = exportFilm();
    film.name = singleLine(name) || film.name;
    film.iso = singleLine(iso) || film.iso;
    film.id = uniqueId(slugify(film.name), films); // the film's own name names the id
    films.push(film);
    persistFilms();
    buildStocks();
    applyFilm(film);
    toast(`Film “${film.name}” saved`);
  }
  function renameFilm(name, iso) {
    const f = activeFilm();
    if (!f) return;
    if (singleLine(name)) f.name = singleLine(name);
    if (singleLine(iso)) f.iso = singleLine(iso);
    persistFilms(); // the id stays stable, only the display text moves
    buildStocks();
    syncControls();
    toast(`Film renamed to “${f.name}”`);
  }
  // ---------- films travel: link, QR, boot import ----------
  function filmB64(film) {
    const bytes = new TextEncoder().encode(JSON.stringify(film));
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function filmLink(film) {
    const f = film || activeFilm() || exportFilm();
    return location.origin + location.pathname + '#film=' + filmB64(f);
  }
  function bootFilmHash() {
    const m = location.hash.match(/^#film=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    let json;
    try {
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    } catch { toast('Refused: the film link is not valid base64'); return; }
    const r = importFilm(json);
    if (r.error) { toast('Refused: ' + r.error); return; }
    toast(`Film “${singleLine(r.film.name)}” imported from the link`);
  }

  function saveOverFilm() {    const f = activeFilm();
    if (!f) return;
    f.look = lookSnapshot();
    persistFilms();
    buildStocks();
    syncControls();
    toast(`Film “${f.name}” updated`);
  }
  function deleteFilm() {
    const i = films.findIndex((f) => f.id === state.stock);
    if (i < 0) return;
    const [gone] = films.splice(i, 1);
    persistFilms();
    buildStocks();
    applyStock('natural');
    toast(`Film “${singleLine(gone.name)}” deleted`);
  }

  // The active film's LUT rides into the render settings next to the look:
  // it lives on the film, never on state.s, so the settings persistence stays
  // small. Every render path builds its settings through this.
  const devSettings = () => ({ ...state.s, lut: activeLut() });

  // ---------- helpers ----------
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));
  function fmtBytes(n) {
    if (!isFinite(n)) return '-';
    if (n < 1024) return Math.round(n) + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    if (n < 1024 ** 3) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 ** 3).toFixed(2) + ' GB';
  }
  const pct = (r) => (r === 1 ? '±0%' : r <= 1 ? `−${Math.round((1 - r) * 100)}%` : `+${Math.round((r - 1) * 100)}%`);
  const safeFolder = (v) => String(v || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/^\.+$/, '') || 'developed';
  const stripAspect = (s) => (s.aspect === 'orig' ? '3:2' : s.aspect);
  // Free crop: fractions of the ROTATED frame, per shot, in the roll metadata.
  const cropOf = (p) => (state.perPhoto[p.name] || {}).crop || null;
  const totalSize = () => state.photos.reduce((a, p) => a + p.size, 0);
  // The shots that get developed: picks in pick order, or the whole roll.
  const sequence = () => {
    const base = state.picks.length ? state.picks.map((i) => state.photos[i]) : state.photos;
    return base.filter((p) => p && !p.missing);
  };
  function stripGroups(n) {
    const seq = sequence(), out = [];
    for (let i = 0; i < seq.length; i += n) out.push(seq.slice(i, i + n));
    return out;
  }
  const groupOf = (p, n) => { const k = sequence().indexOf(p); return k < 0 ? -1 : Math.floor(k / n); };
  // Half-frame batches pair shots; output names share the roll's strip numbering.
  const isHalf = (s) => s.mode !== 'strip' && s.frame === 'halfframe';
  const halfGroups = () => stripGroups(2);
  const halfOf = (p) => groupOf(p, 2);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  let toastTimer = 0;
  function toast(msg, actionLabel, action) {
    $('#toastMsg').textContent = msg;
    const btn = $('#toastAction');
    btn.hidden = !actionLabel;
    if (actionLabel) { btn.textContent = actionLabel; btn.onclick = () => { action(); $('#toast').classList.remove('on'); }; }
    $('#toast').classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('on'), actionLabel ? 9000 : 4000);
  }

  const showIntake = (text) => { const n = $('#intakeLine'); n.hidden = false; n.textContent = text; };
  const hideIntake = () => { $('#intakeLine').hidden = true; };

  // ---------- controls ----------
  function buildStocks() {
    const box = $('#stocks');
    box.replaceChildren();
    for (const st of STOCKS.concat(films)) {
      const b = el('button', 'stock');
      b.dataset.id = st.id;
      b.title = st.name.replace('\n', ' ');
      b.style.setProperty('--c1', st.c1);
      b.style.setProperty('--c2', st.c2);
      if (st.ink) b.style.setProperty('--ink', st.ink);
      b.append(el('span', 's-name', st.name), el('span', 's-iso', st.iso));
      if (!STOCKS.includes(st)) {
        b.classList.add('custom');
        b.append(el('span', 's-custom', 'CUSTOM'));
      }
      b.onclick = () => applyStock(st.id);
      box.append(b);
    }
  }
  function buildSliders() {
    const box = $('#sliders');
    for (const [k, label, min, max, step] of SLIDERS) {
      const row = el('div', 'slider');
      const lab = el('label', null, label);
      lab.title = 'Double-click to reset';
      const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step });
      input.dataset.k = k;
      lab.ondblclick = () => {
        const st = stockById(state.stock);
        input.value = (st.look[k] ?? BASE[k]);
        input.dispatchEvent(new Event('input'));
      };
      row.append(lab, input, el('output'));
      box.append(row);
    }
  }
  function applyStock(id) {
    const st = stockById(id);
    if (!st) return;
    Object.assign(state.s, BASE, st.look);
    state.stock = id;
    state.custom = !STOCKS.includes(st);
    syncControls();
    changed('look');
  }
  function updateStockLabel() {
    const st = stockById(state.stock) || { name: '?' };
    $('#stockName').textContent = st.name.replace('\n', ' ') + (state.custom ? ' · custom' : '');
    document.querySelectorAll('.stock').forEach((b) => b.classList.toggle('active', b.dataset.id === state.stock));
    $('#filmEdit').hidden = !films.some((f) => f.id === state.stock);
  }
  function paintControl(input) {
    if (input.type !== 'range') return;
    const min = +input.min, max = +input.max, v = +input.value;
    input.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%');
    const out = input.parentElement.querySelector('output');
    if (out) {
      const k = input.dataset.k;
      out.textContent = k === 'grainSize' ? v.toFixed(1) : (min < 0 && v > 0 ? '+' : '') + v;
    }
  }
  function syncControls() {
    document.querySelectorAll('[data-k]').forEach((input) => {
      const v = state.s[input.dataset.k];
      if (input.type === 'checkbox') input.checked = !!v;
      else if (input.dataset.k === 'capKB') input.value = v ? String(v) : '';
      else input.value = String(v);
      paintControl(input);
    });
    $('#stripN').disabled = state.s.mode !== 'strip';
    $('#frameSel').disabled = state.s.mode === 'strip';
    $('#frameSel').title = state.s.mode === 'strip' ? 'Film strips always use 35mm frames' : '';
    updateStockLabel();
    updateDevNote();
  }
  function bindControls() {
    document.querySelectorAll('[data-k]').forEach((input) => {
      input.addEventListener('input', () => {
        const k = input.dataset.k;
        let v;
        if (input.type === 'checkbox') v = input.checked;
        else if (input.type === 'range' || input.hasAttribute('data-num')) {
          const n = parseFloat(input.value);
          v = isFinite(n) ? n : 0; // an emptied number field means off
        } else v = input.value;
        state.s[k] = v;
        if (LOOK_KEYS.includes(k)) { state.custom = true; updateStockLabel(); }
        paintControl(input);
        if (k === 'mode') syncControls();
        if (k === 'mode' || k === 'stripN') { refreshItems(); updatePickUI(); updateFrameInfo(); }
        changed(k);
      });
    });
    $('#resetLook').onclick = () => applyStock(state.stock);
  }
  function changed(k) {
    persist();
    if (k === 'folder') { updateDevNote(); return; }
    if (k === 'quality' || k === 'maxEdge' || k === 'capKB' || k === 'format') { scheduleEstimate(); return; }
    schedulePreview();
  }
  function updateDevNote() {
    const note = $('#devNote');
    if (api.outputLabel) { note.textContent = api.outputLabel(safeFolder(state.s.folder)); return; }
    note.textContent = state.roll
      ? `Saves to ${state.roll.name}\\${safeFolder(state.s.folder)}\\ · originals untouched`
      : 'Originals stay untouched';
  }

  // ---------- roll ----------
  async function pickFolder() {
    if (state.busy) return;
    showIntake('Opening the folder…');
    try {
      const roll = await api.pickFolder();
      if (!roll) { hideIntake(); return; }
      await loadRoll(roll);
    } catch (e) {
      hideIntake();
      toast('Could not open folder: ' + e.message);
    }
  }

  async function loadRoll(roll) {
    if (!roll) return;
    $('#intakeLine').hidden = true; // a new roll takes over the intake line
    if (!roll.files.length) { toast(`No photos found in “${roll.name}”`); return; }
    // Relink: a remembered roll re-attaches at half of its shots present by name.
    const meta = rememberedMeta();
    const hits = meta ? roll.files.filter((f) => meta.photos.some((m) => m.name === f.name)) : null;
    const relink = hits && hits.length > 0 && hits.length * 2 >= meta.photos.length ? meta : null;
    state.rollToken++;
    rearmRawAbort(); // any RAW decode of the previous roll is dead weight now
    for (const p of state.photos) if (p.thumb) URL.revokeObjectURL(p.thumb);
    previewCache.clear();
    state.roll = roll;
    state.photos = roll.files.map((f, i) => {
      const m = relink && meta.photos.find((x) => x.name === f.name);
      return { ...f, idx: i, w: 0, h: 0, date: m && m.date ? new Date(m.date) : null, thumb: null, out: null };
    });
    if (relink) {
      const byName = new Map(state.photos.map((p) => [p.name, p.idx]));
      state.picks = (relink.picks || []).map((n) => byName.get(n)).filter((i) => i != null);
      state.stripHigh = relink.stripHigh || 0;
      state.perPhoto = relink.perPhoto || {};
      // Remembered names absent from the folder stay listed, flagged, never dropped.
      const seen = new Set(state.photos.map((p) => p.name));
      for (const m of meta.photos) {
        if (seen.has(m.name)) continue;
        state.photos.push({
          name: m.name, size: m.size || 0, mtime: m.mtime || 0,
          date: m.date ? new Date(m.date) : null,
          idx: state.photos.length, w: 0, h: 0, thumb: null, out: null, missing: true,
        });
      }
      toast(`Roll “${relink.name}” restored · picks and strip numbering are back`);
    } else {
      state.picks = [];
      state.stripHigh = 0;
      state.perPhoto = {};
    }
    state.lastOut = null;
    $('#rememberBanner').hidden = true;
    persistRoll();
    buildRollList();
    updateHeader();
    updateDevNote();
    $('#empty').hidden = true;
    $('#preview').hidden = false;
    updatePickUI();
    select(0);
    schedulePrep(state.rollToken);
  }

  // ---------- picks ----------
  function togglePick(i) {
    if (state.busy || !state.photos[i] || state.photos[i].remembered || state.photos[i].missing) return;
    const k = state.picks.indexOf(i);
    if (k >= 0) state.picks.splice(k, 1);
    else state.picks.push(i);
    refreshPicks();
  }
  function setPicks(list) {
    if (state.busy || !state.photos.length || state.photos.some((p) => p.remembered)) return;
    state.picks = list;
    refreshPicks();
  }
  function refreshPicks() {
    refreshItems();
    updatePickUI();
    updateFrameInfo();
    persistRoll();
    schedulePreview();
  }
  const refreshItems = () => { for (const p of state.photos) updateItem(p); };
  function updatePickUI() {
    const n = state.picks.length, total = state.photos.length, s = state.s;
    document.body.classList.toggle('has-picks', n > 0);
    if (!state.busy) $('#developBtn').textContent = n ? `DEVELOP ${n} PICKED ▸` : 'DEVELOP ROLL ▸';
    const hint = $('#pickHint');
    if (!total) { hint.textContent = 'Tap ○ to pick shots'; return; }
    if (state.photos.some((p) => p.remembered)) {
      $('#developBtn').textContent = 'RE-PICK THE FOLDER TO DEVELOP';
      hint.replaceChildren('Roll remembered · re-pick the folder to restore');
      return;
    }
    const count = n || total, strips = Math.ceil(count / s.stripN);
    const lead = el('b', null, n ? `${n} picked` : `All ${total} shots`);
    if (s.mode === 'strip') {
      hint.replaceChildren(lead, ` → ${strips} strip${strips === 1 ? '' : 's'} of ${s.stripN}`, n ? ' · in pick order' : ' · tap ○ to choose');
    } else {
      hint.replaceChildren(lead, n ? ' will be developed' : ' will be developed · tap ○ to choose');
    }
  }

  function updateHeader() {
    const remembered = state.photos.some((p) => p.remembered);
    const lab = $('#rollLabel');
    if (remembered) {
      lab.replaceChildren('ROLL · ', el('b', null, state.roll.name), ` · REMEMBERED · ${state.photos.length} SHOTS · RE-PICK TO RESTORE`);
      lab.title = 'This roll was remembered by name. Pixels are never stored; re-pick the folder to restore it.';
    } else {
      lab.replaceChildren('ROLL · ', el('b', null, state.roll.name), ` · ${state.photos.length} EXPOSURES · ${fmtBytes(totalSize())}`);
      lab.title = state.roll.dir;
    }
    setLcd(state.photos.length);
    $('#rollCount').textContent = state.photos.length;
    updateFoot();
  }
  const setLcd = (n) => { $('#lcdNum').textContent = String(n).padStart(2, '0'); };
  function updateFoot() {
    const done = state.photos.filter((p) => p.out != null);
    let t = `${state.photos.length} shots · ${fmtBytes(totalSize())}`;
    if (done.length) {
      const b = done.reduce((a, p) => a + p.size, 0), o = done.reduce((a, p) => a + p.out, 0);
      t += `\n${done.length} developed · ${fmtBytes(b)} → ${fmtBytes(o)}`;
    }
    $('#rollFoot').textContent = t;
    $('#rollFoot').style.whiteSpace = 'pre-line';
  }

  // ---------- roll list: tiles render lazily ----------
  const RENDER_BATCH = 60;
  let rollIO = null;

  function buildRollList() {
    const list = $('#rollList');
    list.replaceChildren();
    if (rollIO) { rollIO.disconnect(); rollIO = null; }
    state.rendered = 0;
    const sentinel = el('div', 'roll-sentinel');
    state.sentinel = sentinel;
    list.append(sentinel);
    if (typeof IntersectionObserver === 'function') {
      rollIO = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) renderMoreTiles();
      }, { root: list, rootMargin: '240px' });
      rollIO.observe(sentinel);
    }
    renderMoreTiles();
  }

  function renderMoreTiles() { renderTiles(state.rendered + RENDER_BATCH); }

  function renderTiles(n) {
    const list = $('#rollList');
    const end = Math.min(state.photos.length, n);
    for (; state.rendered < end; state.rendered++) {
      const p = state.photos[state.rendered];
      list.insertBefore(makeTile(p), state.sentinel);
    }
    if (state.rendered >= state.photos.length && state.sentinel.isConnected) {
      state.sentinel.remove();
      if (rollIO) { rollIO.disconnect(); rollIO = null; }
    }
    schedulePrep(state.rollToken);
  }

  function makeTile(p) {
    const item = el('div', 'roll-item');
    item.dataset.i = p.idx;
    const thumb = el('div', 'ri-thumb');
    const img = document.createElement('img');
    img.alt = '';
    thumb.append(img, el('span', 'dec-spin'));
    const meta = el('div', 'ri-meta');
    meta.append(el('div', 'ri-name', p.name), el('div', 'ri-size'));
    const pick = el('button', 'ri-pick');
    pick.title = 'Pick this shot (Space)';
    pick.onclick = (e) => { e.stopPropagation(); togglePick(p.idx); };
    item.append(pick, thumb, meta, el('div', 'ri-num'));
    item.onclick = () => select(p.idx);
    p.el = item;
    updateItem(p);
    return item;
  }
  function updateItem(p) {
    if (!p.el) return;
    if (p.thumb) p.el.querySelector('img').src = p.thumb;
    const size = p.el.querySelector('.ri-size');
    if (p.missing) size.replaceChildren(el('span', 'missing-badge', 'MISSING'));
    else size.replaceChildren(fmtBytes(p.size));
    if (p.out != null) size.append(' → ', el('span', 'out', fmtBytes(p.out)));
    p.el.classList.toggle('remembered', !!p.remembered);
    p.el.classList.toggle('missing', !!p.missing);
    p.el.querySelector('.ri-thumb').classList.toggle('decoding', isRaw(p.name) && p.rawState !== 'decoded');
    p.el.title = p.missing ? 'missing from folder'
      : p.remembered ? 'remembered · re-pick the folder to restore' : '';
    const k = state.picks.indexOf(p.idx);
    p.el.classList.toggle('picked', k >= 0);
    p.el.querySelector('.ri-pick').textContent = k >= 0 ? String(k + 1) : '';
    const num = p.el.querySelector('.ri-num');
    const g = state.s.mode === 'strip' ? groupOf(p, state.s.stripN) : -1;
    num.textContent = g >= 0 ? `S${g + 1}` : String(p.idx + 1).padStart(2, '0');
    num.classList.toggle('in-strip', g >= 0);
    num.title = g >= 0 ? `On strip ${g + 1}` : '';
  }

  // ---------- decoding ----------
  let rawAbort = new AbortController();
  const rawSignal = () => rawAbort.signal;
  const isRaw = (name) => api.isRaw(name);

  function rearmRawAbort() {
    rawAbort.abort();
    rawAbort = new AbortController();
  }

  async function decodeRawFull(p) {
    const c = await api.decodeRaw(p.name, { signal: rawSignal() });
    if (!p.w) { p.w = c.width; p.h = c.height; }
    if (!p.date) {
      // RAW has no JPEG EXIF; the capture date comes from RAW metadata or stays unset.
      const t = await api.rawDate(p.name, { signal: rawSignal() });
      p.date = t ? new Date(t) : null;
    }
    return c;
  }

  async function blobOf(p) {
    const data = await api.readFile(p.name);
    return new Blob([data], { type: 'image/jpeg' });
  }

  async function decode(p) {
    if (isRaw(p.name)) return decodeRawFull(p);
    const blob = await blobOf(p);
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    if (!p.w) { p.w = bmp.width; p.h = bmp.height; }
    if (!p.exif) p.exif = await Engine.exifMeta(blob); // the shot's story, or null
    if (!p.date) p.date = (p.exif && p.exif.date) || new Date(p.mtime);
    return bmp;
  }
  // Bitmaps close themselves; decoded RAW canvases release by being zeroed.
  const dropSource = (b) => {
    if (!b) return;
    if (b.close) b.close();
    else { b.width = 0; b.height = 0; }
  };  // One decoded RAW shot may live in memory per view: the others are dropped.
  function dropRawSources(keep) {
    for (const p of state.photos) {
      if (p.rawSrc && p !== keep) { p.rawSrc.width = 0; p.rawSrc.height = 0; p.rawSrc = null; }
    }
  }
  const previewCache = new Map();
  function cacheSource(p, bmp) {
    const sc = Math.min(1, PREV_EDGE / Math.max(bmp.width, bmp.height));
    const c = Engine.mk(bmp.width * sc, bmp.height * sc);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    previewCache.set(p.name, c);
    while (previewCache.size > 24) previewCache.delete(previewCache.keys().next().value);
    return c;
  }
  // RAW: the in-view shot keeps its full decode, others are dropped.
  async function getSource(p) {
    const hit = previewCache.get(p.name);
    if (hit) { previewCache.delete(p.name); previewCache.set(p.name, hit); return hit; }
    // RAW: the in-view shot keeps its full decode, others are dropped.
    if (isRaw(p.name)) {
      let full = p.rawSrc;
      if (!full) {
        full = p.rawSrc = await decode(p);
        dropRawSources(p);
        refreshRawThumb(p);
      }
      return full;
    }
    const bmp = await decode(p);
    try { return cacheSource(p, bmp); } finally { dropSource(bmp); }
  }

  async function thumbURL(src) {
    const t = Engine.mk(136, 100), x = t.getContext('2d');
    const s = Math.max(136 / src.width, 100 / src.height);
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, (136 - src.width * s) / 2, (100 - src.height * s) / 2, src.width * s, src.height * s);
    const blob = await Engine.encode(t, 82);
    t.width = t.height = 0;
    return URL.createObjectURL(blob);
  }

  async function rawThumb(p, token) {
    try {
      const jpg = await api.rawPreview(p.name, { signal: rawSignal() });
      if (token !== state.rollToken) return;
      p.rawState = jpg ? 'preview' : 'stalled';
      if (!jpg) { updateItem(p); return; }
      const bmp = await createImageBitmap(new Blob([jpg], { type: 'image/jpeg' }));
      try {
        if (token !== state.rollToken) return;
        p.thumb = await thumbURL(bmp);
      } finally { dropSource(bmp); }
      updateItem(p);
      if (p.idx === state.sel) updateFrameInfo();
    } catch (e) {
      console.warn('raw preview thumb failed', p.name, e);
    }
  }

  async function refreshRawThumb(p) {
    if (!p.rawSrc) return;
    p.rawState = 'decoded';
    try {
      const url = await thumbURL(p.rawSrc);
      if (p.thumb) URL.revokeObjectURL(p.thumb);
      p.thumb = url;
      updateItem(p);
      if (p.idx === state.sel) updateFrameInfo();
    } catch (e) { console.warn('raw thumb refresh failed', p.name, e); }
  }

  // ---------- preparing shots (thumbs + the intake line) ----------
  let prepRunning = false, prepQueued = false, prepPromise = Promise.resolve();
  const needPrep = (q) => q.el && !q.prepped && !q.prepping && !q.remembered && !q.missing;

  function schedulePrep(token) {
    if (!prepRunning) prepPromise = runPrep(token);
    else prepQueued = true;
  }

  async function runPrep(token) {
    prepRunning = true;
    $('#intakeLine').hidden = false;
    try {
      let done = 0;
      for (;;) {
        if (token !== state.rollToken) return;
        const p = state.photos.find(needPrep);
        if (!p) break;
        p.prepping = true;
        done++;
        $('#intakeLine').textContent = `Preparing ${done} / ${done + state.photos.filter(needPrep).length}…`;
        try {
          if (isRaw(p.name)) {
            await rawThumb(p, token);
          } else {
            const bmp = await decode(p);
            if (!previewCache.has(p.name) && previewCache.size < 24) cacheSource(p, bmp);
            if (token !== state.rollToken) { dropSource(bmp); return; }
            p.thumb = await thumbURL(bmp);
            dropSource(bmp);
            updateItem(p);
            if (p.idx === state.sel) updateFrameInfo();
          }
        } catch (e) {
          console.warn('prepare failed', p.name, e);
          if (token === state.rollToken) toast(`Could not prepare ${p.name}: ${String(e.message || e).trim()}`);
        } finally {
          p.prepping = false;
          p.prepped = true;
        }
        if (token !== state.rollToken) return;
        await yieldUI();
      }
    } finally {
      prepRunning = false;
      if (prepQueued) { prepQueued = false; schedulePrep(token); }
      else if (token === state.rollToken) $('#intakeLine').hidden = true;
    }
  }

  // ---------- edge print ----------
  // Custom films print their name on the strip edge.
  const edgeLabel = () => {
    const st = stockById(state.stock);
    return st && films.includes(st) ? String(st.name).replace(/\n/g, ' ') : undefined;
  };
  function composeStripLabeled(frames, startNum) {
    const label = edgeLabel();
    state.lastStripLabel = label ?? null;
    return Engine.composeStrip(frames, startNum, label);
  }
  // Half-frame composition records the A/B edge print for the scenarios.
  function composeHalfLabeled(a, b, num) {
    const label = edgeLabel();
    state.lastStripLabel = label ?? null;
    state.lastEdgeNums = [Engine.halfPrint(num, !!b)];
    return Engine.composeHalfFrame(a, b, num, label);
  }
  function applyFrameLabeled(c, s, index) {
    const label = s.frame === '35mm' ? edgeLabel() : undefined;
    state.lastStripLabel = label ?? null;
    return Engine.applyFrame(c, s, index, label);
  }

  // ---------- selection & preview ----------
  function select(i) {
    if (!state.photos.length) return;
    i = Math.max(0, Math.min(state.photos.length - 1, i));
    state.sel = i;
    dropRawSources(null);
    document.querySelectorAll('.roll-item.sel').forEach((n) => n.classList.remove('sel'));
    const p = state.photos[i];
    if (p && !p.el) renderTiles(i + 1); // a keyboard walk can outrun the rendered window
    if (p.el) { p.el.classList.add('sel'); p.el.scrollIntoView({ block: 'nearest' }); }
    updateFrameInfo();
    schedulePreview();
  }
  function updateFrameInfo() {
    const p = state.photos[state.sel];
    if (!p) return;
    const parts = [p.name];
    if (p.w) parts.push(`${p.w}×${p.h}`);
    parts.push(fmtBytes(p.size));
    if (p.date) parts.push(p.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }));
    if (p.remembered) parts.push('remembered · no pixels · re-pick the folder');
    if (p.missing) parts.push('missing from folder · skipped by the batch');
    if (state.s.mode === 'strip') {
      const g = groupOf(p, state.s.stripN);
      parts.push(g >= 0 ? `strip ${g + 1} of ${stripGroups(state.s.stripN).length}` : 'not on a strip');
    } else if (isHalf(state.s)) {
      const g = halfOf(p);
      parts.push(g >= 0 ? `half-frame ${g + 1} of ${halfGroups().length}` : 'not on a half-frame');
    }
    $('#frameInfo').replaceChildren(el('b', null, `${String(state.sel + 1).padStart(2, '0')} / ${String(state.photos.length).padStart(2, '0')}`), '  ·  ' + parts.join('  ·  '));
  }

  let previewQueued = false, previewRunning = false, previewName = 'the shot';
  function schedulePreview() {
    if (!state.photos.length) return;
    previewQueued = true;
    if (!previewRunning) runPreview();
    scheduleEstimate();
  }
  async function runPreview() {
    previewRunning = true;
    $('#spinner').classList.add('on');
    try {
      while (previewQueued) {
        previewQueued = false;
        await renderPreview();
        await nextFrame();
      }
    } catch (e) {
      console.error(e);
      toast(`Preview failed for ${previewName}: ${e.message}`);
    } finally {
      previewRunning = false;
      $('#spinner').classList.remove('on');
    }
  }
  async function renderPreview() {
    const p = state.photos[state.sel];
    previewName = p ? p.name : 'the shot';
    if (!p || p.remembered || p.missing) return;
    const s = devSettings();
    let out;
    const inStrip = s.mode !== 'strip' || groupOf(p, s.stripN) >= 0;
    if (state.cropMode) {
      // Crop mode shows the full rotated frame; the crop rect overlays it.
      out = Engine.renderLook(await getSource(p), p, s, PREV_EDGE, 'orig');
    } else if (isHalf(s)) {
      const g = halfOf(p);
      const group = g >= 0 ? halfGroups()[g] : [p];
      const frames = [];
      for (const q of group) {
        frames.push(Engine.renderLook(await getSource(q), q, s, STRIP_PREV_EDGE, null, cropOf(q)));
      }
      out = composeHalfLabeled(frames[0], frames[1] || null, g + 1);
    } else if (s.mode === 'strip') {
      const g = groupOf(p, s.stripN);
      const group = g >= 0 ? stripGroups(s.stripN)[g] : [p];
      const frames = [];
      for (const q of group) {
        frames.push(Engine.renderLook(await getSource(q), q, s, STRIP_PREV_EDGE, stripAspect(s), cropOf(q)));
      }
      out = composeStripLabeled(frames, g >= 0 ? g * s.stripN + 1 : 1);
    } else {
      const src = await getSource(p);
      out = applyFrameLabeled(Engine.renderLook(src, p, s, PREV_EDGE, null, cropOf(p)), s, state.sel);
    }
    showCanvas(out);
    state.lastOut = out;
    drawCropOverlay();
    $('#viewHint').hidden = inStrip;
    updateFrameInfo();
  }
  function showCanvas(c) {
    const pv = $('#preview');
    pv.width = c.width;
    pv.height = c.height;
    pv.getContext('2d').drawImage(c, 0, 0);
  }

  // ---------- free crop ----------
  // Crop mode dims outside the rect and strokes it; fractions of the shown frame.
  function drawCropOverlay() {
    if (!state.cropMode) return;
    const pv = $('#preview'), x = pv.getContext('2d');
    const r = state.dragCrop || cropOf(state.photos[state.sel]) || { x: 0, y: 0, w: 1, h: 1 };
    const rx = r.x * pv.width, ry = r.y * pv.height, rw = r.w * pv.width, rh = r.h * pv.height;
    x.save();
    x.fillStyle = 'rgba(0,0,0,0.6)';
    x.beginPath();
    x.rect(0, 0, pv.width, pv.height);
    x.rect(rx, ry, rw, rh);
    x.fill('evenodd');
    x.lineWidth = Math.max(2, pv.width * 0.004);
    x.strokeStyle = 'rgba(236,160,58,0.95)';
    x.strokeRect(rx, ry, rw, rh);
    x.restore();
  }
  function setCrop(p, r) {
    if (!p || p.remembered || p.missing) return;
    const m = state.perPhoto[p.name] || (state.perPhoto[p.name] = {});
    if (r) m.crop = r;
    else { delete m.crop; if (!Object.keys(m).length) delete state.perPhoto[p.name]; }
    persistRoll();
    schedulePreview();
  }
  function setCropMode(on) {
    const p = state.photos[state.sel];
    if (on && (!p || p.remembered || p.missing)) {
      toast(!p
        ? 'Pick a shot to crop'
        : 'This shot is a placeholder: re-pick the folder to crop it');
      return;
    }
    state.cropMode = on;
    $('#cropBtn').hidden = on;
    $('#cropReset').hidden = !on;
    $('#cropDone').hidden = !on;
    schedulePreview();
  }
  const fracOf = (e) => {
    const r = $('#preview').getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  let cropDrag = null;
  $('#preview').addEventListener('pointerdown', (e) => {
    if (!state.cropMode || state.busy) return;
    cropDrag = fracOf(e);
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!cropDrag) return;
    const f = fracOf(e);
    state.dragCrop = {
      x: Math.round(Math.min(cropDrag.x, f.x) * 1000) / 1000,
      y: Math.round(Math.min(cropDrag.y, f.y) * 1000) / 1000,
      w: Math.round(Math.abs(cropDrag.x - f.x) * 1000) / 1000,
      h: Math.round(Math.abs(cropDrag.y - f.y) * 1000) / 1000,
    };
    drawCropOverlay();
  });
  window.addEventListener('pointerup', () => {
    if (!cropDrag) return;
    const r = state.dragCrop;
    cropDrag = null;
    state.dragCrop = null;
    if (r && r.w >= 0.02 && r.h >= 0.02) setCrop(state.photos[state.sel], r);
    drawCropOverlay();
  });

  // ---------- full-resolution renders ----------
  async function renderSingleFull(p, s) {
    const bmp = await decode(p);
    try { return applyFrameLabeled(Engine.renderLook(bmp, p, s, s.maxEdge || Infinity, null, cropOf(p)), s, p.idx); }
    finally { dropSource(bmp); }
  }
  async function renderStripFull(gi, s) {
    const group = stripGroups(s.stripN)[gi];
    const edge = s.maxEdge ? Math.min(s.maxEdge, 2400) : 2000;
    const frames = [];
    for (const q of group) {
      const bmp = await decode(q);
      try { frames.push(Engine.renderLook(bmp, q, s, edge, stripAspect(s), cropOf(q))); } finally { dropSource(bmp); }
    }
    return { canvas: composeStripLabeled(frames, gi * s.stripN + 1), group };
  }
  async function renderHalfFull(gi, s, num) {
    const group = halfGroups()[gi];
    const edge = s.maxEdge ? Math.min(s.maxEdge, 2400) : 2000;
    const frames = [];
    for (const q of group) {
      const bmp = await decode(q);
      try { frames.push(Engine.renderLook(bmp, q, s, edge, null, cropOf(q))); } finally { dropSource(bmp); }
    }
    return { canvas: composeHalfLabeled(frames[0], frames[1] || null, num), group };
  }

  // ---------- size estimate ----------
  // Encode under the optional size cap: JPG/WebP binary-search quality (floor
  // 10); PNG scales the long edge in 10% steps to 50%.
  async function encodeFits(canvas, s) {
    const cap = (s.capKB || 0) * 1024;
    if (!cap) return Engine.encode(canvas, s.quality, s.format);
    if (s.format === 'image/png') {
      let scale = 1;
      for (;;) {
        let c = canvas;
        if (scale < 1) {
          c = Engine.mk(canvas.width * scale, canvas.height * scale);
          const x = c.getContext('2d');
          x.imageSmoothingQuality = 'high';
          x.drawImage(canvas, 0, 0, c.width, c.height);
        }
        const blob = await Engine.encode(c, s.quality, 'image/png');
        if (c !== canvas) c.width = c.height = 0;
        if (blob.size <= cap || scale <= 0.5) return blob;
        scale = Math.max(0.5, Math.round((scale - 0.1) * 10) / 10);
      }
    }
    let blob = await Engine.encode(canvas, s.quality, s.format);
    if (blob.size <= cap) return blob;
    let lo = 10, hi = Math.floor(s.quality), best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = await Engine.encode(canvas, mid, s.format);
      if (b.size <= cap) { best = b; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best || (await Engine.encode(canvas, 10, s.format));
  }

  let estTimer = 0, estSeq = 0;
  function scheduleEstimate() {
    clearTimeout(estTimer);
    if (!state.photos.length) return;
    $('#estOne').textContent = 'measuring…';
    estTimer = setTimeout(runEstimate, 650);
  }
  async function runEstimate() {
    if (state.busy) return;
    const seq = ++estSeq, s = devSettings();
    try {
      let canvas, before;
      if (s.mode === 'strip') {
        const r = await renderStripFull(Math.max(0, groupOf(state.photos[state.sel], s.stripN)), s);
        canvas = r.canvas;
        before = r.group.reduce((a, q) => a + q.size, 0);
      } else if (isHalf(s)) {
        const r = await renderHalfFull(Math.max(0, halfOf(state.photos[state.sel])), s, 1);
        canvas = r.canvas;
        before = r.group.reduce((a, q) => a + q.size, 0);
      } else {
        const p = state.photos[state.sel];
        canvas = await renderSingleFull(p, s);
        before = p.size;
      }
      if (seq !== estSeq) return;
      const blob = await encodeFits(canvas, s);
      if (seq !== estSeq) return;
      const ratio = blob.size / before, total = sequence().reduce((a, q) => a + q.size, 0);
      $('#estOne').textContent = `${fmtBytes(before)} → ${fmtBytes(blob.size)}  ${pct(ratio)}`;
      $('#estAll').textContent = `${fmtBytes(total)} → ≈${fmtBytes(total * ratio)}`;
    } catch (e) {
      console.error(e);
      if (seq === estSeq) $('#estOne').textContent = '-';
    }
  }

  // ---------- develop ----------
  // label names the work on the develop button while it runs ("PRINTING…").
  function setBusy(on, label) {
    state.busy = on;
    for (const id of ['#developBtn', '#saveOneBtn', '#loadBtn', '#emptyLoad', '#printBtn']) $(id).disabled = on;
    if (on) $('#developBtn').textContent = label || 'DEVELOPING…';
    else updatePickUI();
  }
  const setProgress = (f) => { $('#progressBar').style.width = Math.round(f * 100) + '%'; };

  async function develop(onlyCurrent) {
    if (state.busy || !state.photos.length) return;
    if (state.photos.some((p) => p.remembered)) { toast('This roll is remembered by name only. Re-pick the folder to restore it.'); return; }
    const s = devSettings(), folder = safeFolder(s.folder);
    const strip = s.mode === 'strip';
    const half = isHalf(s);
    const cur = state.photos[state.sel];
    if (onlyCurrent && cur && cur.missing) { toast('That shot is missing from the folder, so there is nothing to develop.'); return; }
    const jobs = strip
      ? (onlyCurrent ? [groupOf(cur, s.stripN)].filter((g) => g >= 0) : stripGroups(s.stripN).map((_, i) => i))
      : half
        ? (onlyCurrent ? [halfOf(cur)].filter((g) => g >= 0) : halfGroups().map((_, i) => i))
        : (onlyCurrent ? [state.sel] : sequence().map((p) => p.idx));
    if (!jobs.length) { toast('This shot isn’t on a strip yet. Pick it first (Space or ○).'); return; }
    setBusy(true);
    setProgress(0);
    clearTimeout(estTimer);
    estSeq++;
    let before = 0, after = 0, done = 0, attempts = 0;
    const failures = []; // "name (reason)" entries, reported at the end of the run
    // Strips continue the roll's numbering from the remembered high-water mark.
    const stripBase = state.stripHigh || 0;
    try {
      if (api.beginBatch) await api.beginBatch(folder); // first await: still inside the click, so the browser may prompt
      const fmt = EXT[s.format] ? s.format : 'image/jpeg';
      const ext = EXT[fmt];
      for (const j of jobs) {
        attempts++;
        let canvas, group, name, label;
        try {
          if (strip) {
            label = name = `strip_${String(stripBase + j + 1).padStart(3, '0')}.${ext}`;
            ({ canvas, group } = await renderStripFull(j, s));
          } else if (half) {
            label = name = `strip_${String(stripBase + j + 1).padStart(3, '0')}.${ext}`;
            ({ canvas, group } = await renderHalfFull(j, s, stripBase + j + 1));
          } else {
            const p = state.photos[j];
            group = [p];
            name = p.name.replace(/\.[a-z0-9]+$/i, '') + '.' + ext;
            label = p.name;
            canvas = await renderSingleFull(p, s);
          }
          const blob = await encodeFits(canvas, { ...s, format: fmt });
          canvas.width = canvas.height = 0;
          let bytes = await blob.arrayBuffer();
          if (s.keepExif && fmt === 'image/jpeg') {
            const story = group[0].exif || (group[0].date ? { date: group[0].date } : null);
            bytes = Exif.stamp(new Uint8Array(bytes), story, s.gpsExif).buffer;
          }
          const written = await api.writeFile(folder, name, bytes, fmt);
          const stripNum = String(written).match(/strip_(\d+)/);
          if (stripNum) {
            state.stripHigh = Math.max(state.stripHigh, +stripNum[1]);
            persistRoll();
          }
          before += group.reduce((a, q) => a + q.size, 0);
          after += blob.size;
          done++;
          if (strip) { /* strip outputs carry no per-shot size */ }
          else if (half) { for (const q of group) { q.out = blob.size; updateItem(q); } }
          else { group[0].out = blob.size; updateItem(group[0]); }
        } catch (e) {
          // One bad shot never stops the batch: name it with a reason and go on.
          console.error('develop failed:', label || `#${j}`, e);
          failures.push(`${label || `#${j}`} (${String(e.message || e).trim()})`);
          if (canvas) { canvas.width = canvas.height = 0; canvas = null; }
        }
        setProgress(attempts / jobs.length);
        setLcd(jobs.length - attempts);
        $('#devNote').textContent = `Developing ${attempts} / ${jobs.length}…`;
        await yieldUI();
      }
      const downloaded = api.endBatch ? await api.endBatch() : null;
      const what = strip ? 'strip' : half ? 'half-frame' : 'photo';
      let msg = `Developed ${done} ${what}${done === 1 ? '' : 's'}`;
      if (failures.length) msg = `Developed ${done}, failed ${failures.length}: ${failures.join(', ')}`;
      else msg += ` · ${fmtBytes(before)} → ${fmtBytes(after)} (${pct(after / before)})`;
      if (downloaded) toast(`${msg} · downloaded ${downloaded}`);
      else if (isWeb) toast(msg);
      else toast(msg, 'OPEN FOLDER', () => api.openOutput(folder));
    } catch (e) {
      console.error(e);
      const partial = api.endBatch ? await api.endBatch().catch(() => null) : null;
      toast(`Stopped after ${done} file${done === 1 ? '' : 's'}: ${e.message}${partial ? ` · downloaded ${partial}` : ''}`);
    } finally {
      setBusy(false);
      setLcd(state.photos.length);
      updateFoot();
      updateDevNote();
      setTimeout(() => setProgress(0), 2500);
    }
  }

  // ---------- contact sheet (PS-38) ----------
  // The roll prints as a proof sheet: the same strip composites Film strips
  // output produces, two per A4 portrait page, each with a caption line. The
  // first page names the film, the roll and the print date. Strips number
  // from 1; the sheet never touches the developed files' strip numbering.
  // Embedded strips develop at a 1200 px proof edge (or the Max size cap when
  // it is lower) and encode at fixed quality 75, so the sheet stays small.
  async function printContactSheet() {
    if (state.busy || !state.photos.length) return;
    if (state.photos.some((p) => p.remembered)) { toast('This roll is remembered by name only. Re-pick the folder to restore it.'); return; }
    const s = devSettings();
    const half = isHalf(s);
    const groups = half ? halfGroups() : stripGroups(s.stripN);
    if (!groups.length) { toast('Nothing to print: the whole roll is missing from the folder.'); return; }
    setBusy(true, 'PRINTING…');
    setProgress(0);
    clearTimeout(estTimer);
    estSeq++;
    try {
      if (api.beginBatch) await api.beginBatch('prints');
      const film = stockById(state.stock);
      const ps = Pdf.document();
      const M = 40, top = ps.size.height - M, availW = ps.size.width - M * 2;
      let page = ps.page(), cursorY = top, slot = 0;
      // Page 1 header: film name on the bold line, roll line under it.
      page.text(singleLine(film ? film.name : 'Custom film'), M, top - 12, { size: 14, bold: true });
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      page.text(`Roll ${state.roll.name} - ${sequence().length} frames - printed ${dateStr}`, M, top - 30, { size: 10, gray: 0.35 });
      cursorY = top - 44;
      const proofEdge = s.maxEdge ? Math.min(s.maxEdge, 2400) : 1200;
      const rs = { ...s, maxEdge: proofEdge };
      let done = 0;
      const failures = []; // "strip n (reason)" entries, reported at the end
      for (let gi = 0; gi < groups.length; gi++) {
        let canvas, group;
        try {
          ({ canvas, group } = half ? await renderHalfFull(gi, rs, gi + 1) : await renderStripFull(gi, rs));
          const w = canvas.width, h = canvas.height;
          const jpeg = await Engine.encode(canvas, 75);
          canvas.width = canvas.height = 0;
          const drawH = (h * availW) / w;
          const slotH = drawH + 18; // strip plus its caption line
          // Two strips per page; the space check is a safety net for
          // unusually tall strips.
          if (slot === 2 || cursorY - slotH < M) { page = ps.page(); cursorY = top; slot = 0; }
          const x = (ps.size.width - availW) / 2;
          page.jpeg(new Uint8Array(await jpeg.arrayBuffer()), w, h, x, cursorY - drawH, availW, drawH);
          page.text(`Strip ${gi + 1} - ${group.length} frames`, x, cursorY - drawH - 10, { size: 9, gray: 0.4 });
          cursorY -= slotH;
          slot++;
          done++;
          setProgress((gi + 1) / groups.length);
        } catch (e) {
          console.error('contact sheet strip failed:', gi + 1, e);
          failures.push(`strip ${gi + 1} (${String(e.message || e).trim()})`);
        }
        setLcd(groups.length - (gi + 1));
        $('#devNote').textContent = `Printing ${gi + 1} / ${groups.length}…`;
        await yieldUI();
      }
      if (!done) {
        toast(`Could not print the contact sheet: ${failures.join(', ')}`);
        return;
      }
      const bytes = ps.end();
      const written = await api.writeFile('prints', `${state.roll.name}-contact-sheet.pdf`, bytes, 'application/pdf');
      let msg = `Contact sheet ready - ${done} strip${done === 1 ? '' : 's'} - ${fmtBytes(bytes.length)}`;
      if (failures.length) msg = `Printed ${done}, failed ${failures.length}: ${failures.join(', ')} - ${fmtBytes(bytes.length)}`;
      const downloaded = api.endBatch ? await api.endBatch() : null;
      toast(downloaded ? `${msg} - downloaded ${written}` : msg);
    } catch (e) {
      console.error(e);
      const partial = api.endBatch ? await api.endBatch().catch(() => null) : null;
      toast(`Contact sheet stopped: ${e.message}${partial ? ` - downloaded ${partial}` : ''}`);
    } finally {
      setBusy(false);
      setLcd(state.photos.length);
      setTimeout(() => setProgress(0), 2500);
    }
  }

  async function showOriginal() {
    const p = state.photos[state.sel];
    if (p) showCanvas(await getSource(p));
  }
  function hideOriginal() { if (state.lastOut) showCanvas(state.lastOut); }

  // ---------- wiring ----------
  window.__darkroom = { loadRoll, develop, applyStock, togglePick, setPicks, select, state, exportFilm, importFilm, filmLink, printContactSheet, whenReady: () => prepPromise }; // debugging / smoke tests
  window.__intakeLog = []; // accounting for the BDD suite and debugging
  api.onIntakeProgress((done, total) => {
    showIntake(total ? `Reading ${done} / ${total}…` : 'Reading the folder…');
    window.__intakeLog.push(`${done}/${total}`);
  });
  buildStocks();
  buildSliders();
  bindControls();
  syncControls();
  bootFilmHash(); // a shared film link wins before anything else runs
  showRememberedRoll();

  $('#loadBtn').onclick = pickFolder;
  $('#emptyLoad').onclick = pickFolder;
  $('#rememberLoad').onclick = pickFolder;
  $('#rollList').addEventListener('scroll', () => {
    const list = $('#rollList');
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 800) renderMoreTiles();
  });
  $('#prevBtn').onclick = () => select(state.sel - 1);
  $('#nextBtn').onclick = () => select(state.sel + 1);
  $('#developBtn').onclick = () => develop(false);
  $('#printBtn').onclick = () => printContactSheet();
  $('#saveOneBtn').onclick = () => develop(true);
  $('#pickAll').onclick = () => setPicks(state.photos.map((p) => p.idx));
  $('#pickNone').onclick = () => setPicks([]);

  // ---------- film studio ----------
  let filmDlgMode = 'save';
  // Where the import dialog's payload came from: pasted JSON refuses LUT
  // films (the sharing cap), a chosen .json file takes them, and a chosen
  // .cube file imports through the cube parser.
  let filmFromText = 'paste';
  let filmCubeText = null, filmCubeName = '';
  function openFilmDlg(mode) {
    filmDlgMode = mode;
    $('#filmDlgTitle').textContent = mode === 'import' ? 'IMPORT FILM' : mode === 'rename' ? 'RENAME FILM' : 'SAVE FILM';
    $('#filmSaveFields').hidden = mode === 'import';
    $('#filmImportFields').hidden = mode !== 'import';
    $('#filmJson').value = '';
    $('#filmShareFields').hidden = mode === 'import';
    $('#filmJson').value = '';
    filmFromText = 'paste';
    filmCubeText = null;
    if (mode !== 'import') {
      const link = filmLink();
      if (activeLut()) {
        // The sharing cap (ADR 0006): a LUT film shares as a downloaded file.
        $('#filmQr').hidden = true;
        toast(lutQrCap);
      } else {
        const drew = Qr.draw($('#filmQr'), link);
        $('#filmQr').hidden = !drew;
      }
      $('#copyLinkBtn').onclick = async () => {
        if (activeLut()) { toast(lutQrCap); return; }
        try { await navigator.clipboard.writeText(link); toast('Film link copied to clipboard'); }
        catch { toast('Clipboard refused'); }
      };
    }
    if (mode === 'rename') {
      const f = activeFilm();
      $('#filmName').value = f ? singleLine(f.name) : '';
      $('#filmIso').value = f ? f.iso : '';
    } else if (mode === 'save') {
      const st = stockById(state.stock);
      $('#filmName').value = st ? singleLine(st.name) : '';
      $('#filmIso').value = st ? String(st.iso) : 'CUSTOM';
    } else {
      $('#filmName').value = '';
      $('#filmIso').value = '';
    }
    $('#filmOk').textContent = mode === 'import' ? 'IMPORT' : 'SAVE';
    $('#filmDlg').showModal();
    (mode === 'import' ? $('#filmJson') : $('#filmName')).focus();
  }
  function onFilmOk() {
    if (filmDlgMode === 'import') {
      if (filmCubeText !== null) {
        const r = importCube(filmCubeText, filmCubeName);
        if (r.error) { toast('Refused: ' + r.error); return; }
        $('#filmDlg').close();
        toast(`Film “${singleLine(r.film.name)}” imported from the cube`);
        return;
      }
      const r = importFilm($('#filmJson').value, filmFromText === 'file');
      if (r.error) { toast('Refused: ' + r.error); return; }
      $('#filmDlg').close();
      toast(`Film “${singleLine(r.film.name)}” applied`);
      return;
    }
    if (!singleLine($('#filmName').value)) { toast('Give the film a name'); return; }
    if (filmDlgMode === 'save') saveFilm($('#filmName').value, $('#filmIso').value);
    if (filmDlgMode === 'rename') renameFilm($('#filmName').value, $('#filmIso').value);
    $('#filmDlg').close();
  }
  $('#exportFilmBtn').onclick = async () => {
    const film = exportFilm();
    const json = JSON.stringify(film, null, 2);
    try { await api.writeFile('films', `${film.id}.json`, json, 'application/json'); } catch (e) { toast('Could not export film: ' + e.message); return; }
    toast(`Film exported as ${film.id}.json`, 'COPY JSON', async () => {
      try { await navigator.clipboard.writeText(json); toast('Film JSON copied to clipboard'); }
      catch { toast('Clipboard refused; use the downloaded file'); }
    });
  };
  $('#exportCubeBtn').onclick = async () => {
    const film = exportFilm();
    const text = bakeCube(film);
    try { await api.writeFile('films', `${film.id}.cube`, text, 'text/plain'); } catch (e) { toast('Could not export cube: ' + e.message); return; }
    toast(`Cube exported as ${film.id}.cube`);
  };
  $('#importFilmBtn').onclick = () => openFilmDlg('import');
  $('#saveFilmBtn').onclick = () => openFilmDlg('save');
  $('#renameFilmBtn').onclick = () => openFilmDlg('rename');
  $('#saveOverBtn').onclick = saveOverFilm;
  $('#deleteFilmBtn').onclick = deleteFilm;
  $('#filmCancel').onclick = () => $('#filmDlg').close();
  $('#filmOk').onclick = onFilmOk;
  $('#filmFile').onchange = async () => {
    const f = $('#filmFile').files[0];
    if (!f) return;
    if (/\.cube$/i.test(f.name)) {
      filmCubeText = await f.text();
      filmCubeName = f.name;
      return;
    }
    filmCubeText = null;
    $('#filmJson').value = await f.text();
    filmFromText = 'file';
  };
  $('#filmJson').addEventListener('input', () => { filmFromText = 'paste'; });
  const cmp = $('#compareBtn');
  cmp.addEventListener('pointerdown', showOriginal);
  for (const ev of ['pointerup', 'pointerleave']) cmp.addEventListener(ev, hideOriginal);
  $('#cropBtn').onclick = () => setCropMode(true);
  $('#cropDone').onclick = () => setCropMode(false);
  $('#cropReset').onclick = () => setCrop(state.photos[state.sel], null);

  window.addEventListener('keydown', (e) => {
    // Typing fields never navigate.
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) {
      if (e.key === 'Escape') $('#filmDlg').close();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'k') { select(state.sel - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'j') { select(state.sel + 1); e.preventDefault(); }
    else if (e.key === ' ' && !e.target.matches('button')) { togglePick(state.sel); e.preventDefault(); }
    else if (e.key === 'Enter' && !e.target.matches('button')) { develop(true); e.preventDefault(); }
  });

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    if (state.busy || !e.dataTransfer.files.length) return;
    try {
      showIntake('Opening the drop…'); // sync: openDrop must be called before any await
      // web: openDrop must run before any await, while the drop items are readable
      if (api.openDrop) { await loadRoll(await api.openDrop(e.dataTransfer)); return; }
      const p = api.pathForFile(e.dataTransfer.files[0]);
      if (p) await loadRoll(await api.openDir(p));
    } catch (err) { hideIntake(); toast('Could not open: ' + err.message); }
  });

  // ---------- paste a photo ----------
  // The roll loads JPG photos by law; a pasted PNG re-encodes, others are refused by name.
  async function pastePhoto(file) {
    if (state.busy || !file) return;
    const mime = file.type || '';
    if (mime !== 'image/jpeg' && mime !== 'image/png') {
      const fmt = (mime.split('/')[1] || 'unknown').toUpperCase();
      toast(`Pasted ${fmt} refused: the roll loads JPG photos only`);
      return;
    }
    let blob = file;
    if (mime === 'image/png') {
      const bmp = await createImageBitmap(file);
      const c = Engine.mk(bmp.width, bmp.height);
      c.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close();
      blob = await Engine.encode(c, 90);
      c.width = c.height = 0;
    }
    const base = String(file.name || '').replace(/\.[^.]+$/, '').trim() || 'pasted';
    let name = `${base}.jpg`;
    const taken = new Set(state.photos.map((p) => p.name.toLowerCase()));
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n}).jpg`;
    const jpg = new File([blob], name, { type: 'image/jpeg' });
    if (!state.roll) {
      await loadRoll(api.fromPaste(jpg, name)); // starts a roll called "pasted"
      toast(`Pasted ${name} starts a new roll`);
      return;
    }
    const at = state.photos.findIndex((q) =>
      q.name.localeCompare(name, undefined, { numeric: true, sensitivity: 'base' }) > 0);
    const i = at < 0 ? state.photos.length : at;
    state.photos.splice(i, 0, {
      name, size: jpg.size, mtime: jpg.lastModified,
      idx: 0, w: 0, h: 0, date: null, thumb: null, out: null,
    });
    state.photos.forEach((p, k) => { p.idx = k; });
    state.picks = state.picks.map((n) => (n >= i ? n + 1 : n));
    api.addRollFile(name, jpg);
    persistRoll();
    buildRollList();
    updateHeader();
    updateDevNote();
    updatePickUI();
    select(i);
    schedulePrep(state.rollToken);
    toast(`Pasted ${name} added to “${state.roll.name}”`);
  }

  window.addEventListener('paste', (e) => {
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    const files = [...(e.clipboardData ? e.clipboardData.items : [])]
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (!files.length) return; // plain-text pastes (film JSON) keep their default path
    e.preventDefault();
    (async () => { for (const f of files) await pastePhoto(f); })();
  });

  // ---------- shared photos ----------
  // Share Target: the service worker hands shared files here, same intake as a paste.
  function intakeShared(files) {
    const usable = (files || []).filter(Boolean);
    if (!usable.length) { toast('The share carried no photos the roll could load'); return; }
    (async () => { for (const f of usable) await pastePhoto(f); })();
  }
  if (window.launchQueue) {
    window.launchQueue.setConsumer((launch) => {
      const files = launch && launch.files ? [...launch.files].filter(Boolean) : [];
      if (files.length) intakeShared(files);
      else if (launch && launch.targetURL) toast('The share carried no photos the roll could load');
    });
  }
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'share') intakeShared(e.data.files);
    });
  }

  // ---------- service worker (web builds only) ----------
  if (isWeb && window.isSecureContext && 'serviceWorker' in navigator) {
    // The page reloads ONLY after the user clicked the update toast.
    let userClickedReload = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (userClickedReload) window.location.reload();
    });
    const offerUpdate = (worker) => {
      toast('New version ready', 'RELOAD', () => {
        userClickedReload = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      });
    };
    navigator.serviceWorker.register('sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    }).catch(() => { /* offline helpers are optional */ });
  }
})();
