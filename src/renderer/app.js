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
    aspect: 'orig', frame: 'none', date: false,
  };
  const LOOK_KEYS = Object.keys(BASE);
  const OUTPUT_DEFAULTS = { quality: 72, maxEdge: 0, capKB: 0, mode: 'single', stripN: 4, folder: 'developed', dateFmt: 'ymd', format: 'image/jpeg', keepExif: false };
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
    'leak', 'flicker', 'aspect', 'frame', 'date', 'dateFmt',
  ];
  const FRAMES = ['none', '35mm', 'super8', 'instant'];
  const DATE_FMTS = ['ymd', 'mdy', 'dmy'];
  const HEX = /^#[0-9a-f]{6}$/i;
  // The library loads before the settings restore, which may point at one of
  // these films. Films are schema v1 objects (see docs/internals/film-schema.md).
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
      if (stockById(saved.stock)) state.stock = saved.stock;
      state.custom = !!saved.custom;
    }
  } catch { /* first run */ }
  // An active library film restores exactly: its look wins over stored sliders.
  {
    const active = films.find((f) => f.id === state.stock);
    if (active) { Object.assign(state.s, BASE, active.look); state.custom = true; }
  }
  function persist() {
    try { localStorage.setItem('darkroom.settings', JSON.stringify({ s: state.s, stock: state.stock, custom: state.custom })); } catch { /* ignore */ }
  }

  // ---------- roll memory (metadata only, pixels never) ----------
  // darkroom.roll remembers what a roll was: shot names, sizes, mtimes, EXIF
  // dates already parsed, picks (by file name) and the strip high-water mark.
  // No image bytes, no data URLs, no base64: the entry stays a few bytes a shot.
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

  // Boot with a remembered roll: names come back, pixels do not. The contact
  // sheet lists the shots greyed out until the folder is re-picked.
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
  function uniqueId(base, taken) {
    let id = base, n = 2;
    while (taken.some((x) => x.id === id)) id = `${base}-${n++}`;
    return id;
  }
  const lookSnapshot = () => { const look = {}; for (const k of LOOK_FIELDS) look[k] = state.s[k]; return look; };
  function exportFilm() {
    const st = stockById(state.stock);
    const name = st ? singleLine(st.name) : 'Custom film';
    let base = slugify(name);
    if (state.custom && STOCKS.some((x) => x.id === base)) base += '-custom'; // never a built-in's id
    return { schema: 1, id: uniqueId(base, films), name, iso: st ? String(st.iso) : 'CUSTOM', look: lookSnapshot() };
  }
  function applyFilm(film) {
    Object.assign(state.s, BASE, film.look);
    state.stock = film.id;
    state.custom = true;
    syncControls();
    changed('look');
  }
  // Returns an error message, or null when the film is a valid schema v1 film.
  function validateFilm(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'this is not a film JSON';
    if (raw.schema !== 1) return `unknown film schema version ${JSON.stringify(raw.schema)} (expected 1)`;
    for (const k of ['id', 'name']) if (typeof raw[k] !== 'string' || !raw[k].trim()) return `film ${k} is missing`;
    if (typeof raw.iso !== 'string') return 'film iso must be text';
    const look = raw.look;
    if (!look || typeof look !== 'object' || Array.isArray(look)) return 'film look is missing';
    for (const k of Object.keys(look)) if (!LOOK_FIELDS.includes(k)) return `unknown look key "${k}"`;
    for (const k of LOOK_FIELDS) if (!(k in look)) return `look is missing "${k}"`;
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
    return null;
  }
  function importFilm(text) {
    let raw;
    try { raw = JSON.parse(text); } catch { return { error: 'this is not JSON' }; }
    const err = validateFilm(raw);
    if (err) return { error: err };
    const film = { schema: 1, id: String(raw.id).trim(), name: raw.name, iso: raw.iso, look: raw.look };
    const at = films.findIndex((f) => f.id === film.id);
    if (at >= 0) films[at] = film; // the same film updates in place
    else films.push(film);
    persistFilms();
    buildStocks();
    applyFilm(film);
    return { film };
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
  function saveOverFilm() {
    const f = activeFilm();
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

  // ---------- helpers ----------
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // rAF stalls when the window is hidden/minimised, so background work yields with a macrotask instead
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));
  function fmtBytes(n) {
    if (!isFinite(n)) return '—';
    if (n < 1024) return Math.round(n) + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    if (n < 1024 ** 3) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 ** 3).toFixed(2) + ' GB';
  }
  const pct = (r) => (r <= 1 ? `−${Math.round((1 - r) * 100)}%` : `+${Math.round((r - 1) * 100)}%`);
  const safeFolder = (v) => String(v || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/^\.+$/, '') || 'developed';
  const stripAspect = (s) => (s.aspect === 'orig' ? '3:2' : s.aspect);
  const totalSize = () => state.photos.reduce((a, p) => a + p.size, 0);
  // the shots that get developed / put on strips: picks in pick order, or the whole roll
  const sequence = () => (state.picks.length ? state.picks.map((i) => state.photos[i]) : state.photos);
  function stripGroups(n) {
    const seq = sequence(), out = [];
    for (let i = 0; i < seq.length; i += n) out.push(seq.slice(i, i + n));
    return out;
  }
  const groupOf = (p, n) => { const k = sequence().indexOf(p); return k < 0 ? -1 : Math.floor(k / n); };
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
    try { await loadRoll(await api.pickFolder()); } catch (e) { toast('Could not open folder: ' + e.message); }
  }

  async function loadRoll(roll) {
    if (!roll) return;
    if (!roll.files.length) { toast(`No .jpg files found in “${roll.name}”`); return; }
    state.rollToken++;
    for (const p of state.photos) if (p.thumb) URL.revokeObjectURL(p.thumb);
    previewCache.clear();
    state.roll = roll;
    state.photos = roll.files.map((f, i) => ({ ...f, idx: i, w: 0, h: 0, date: null, thumb: null, out: null }));
    state.picks = [];
    state.stripHigh = 0;
    state.perPhoto = {};
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
    genThumbs(state.rollToken);
  }

  // ---------- picks ----------
  function togglePick(i) {
    if (state.busy || !state.photos[i] || state.photos[i].remembered) return;
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

  function buildRollList() {
    const list = $('#rollList');
    list.replaceChildren();
    for (const p of state.photos) {
      const item = el('div', 'roll-item');
      item.dataset.i = p.idx;
      const thumb = el('div', 'ri-thumb');
      const img = document.createElement('img');
      img.alt = '';
      thumb.append(img);
      const meta = el('div', 'ri-meta');
      meta.append(el('div', 'ri-name', p.name), el('div', 'ri-size'));
      const pick = el('button', 'ri-pick');
      pick.title = 'Pick this shot (Space)';
      pick.onclick = (e) => { e.stopPropagation(); togglePick(p.idx); };
      item.append(pick, thumb, meta, el('div', 'ri-num'));
      item.onclick = () => select(p.idx);
      p.el = item;
      updateItem(p);
      list.append(item);
    }
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

  // decoding
  async function blobOf(p) {
    const data = await api.readFile(p.name);
    return new Blob([data], { type: 'image/jpeg' });
  }
  async function decode(p) {
    const blob = await blobOf(p);
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    if (!p.w) { p.w = bmp.width; p.h = bmp.height; }
    if (!p.date) p.date = (await Engine.exifDate(blob)) || new Date(p.mtime);
    return bmp;
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
  async function getSource(p) {
    const hit = previewCache.get(p.name);
    if (hit) { previewCache.delete(p.name); previewCache.set(p.name, hit); return hit; }
    const bmp = await decode(p);
    try { return cacheSource(p, bmp); } finally { bmp.close(); }
  }

  async function genThumbs(token) {
    for (const p of state.photos) {
      if (token !== state.rollToken) return;
      if (p.thumb || p.remembered) continue;
      try {
        const bmp = await decode(p);
        if (!previewCache.has(p.name) && previewCache.size < 24) cacheSource(p, bmp);
        const t = Engine.mk(136, 100), x = t.getContext('2d');
        const s = Math.max(136 / bmp.width, 100 / bmp.height);
        x.imageSmoothingQuality = 'high';
        x.drawImage(bmp, (136 - bmp.width * s) / 2, (100 - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
        bmp.close();
        if (token !== state.rollToken) return;
        p.thumb = URL.createObjectURL(await Engine.encode(t, 82));
        updateItem(p);
        if (p.idx === state.sel) updateFrameInfo();
      } catch (e) {
        console.warn('thumb failed', p.name, e);
      }
      await yieldUI();
    }
  }

  // ---------- edge print ----------
  // Custom films print their name on the strip edge; built-in stocks keep
  // PHOTOSET 400. lastStripLabel records what the latest render used.
  const edgeLabel = () => {
    const st = stockById(state.stock);
    return st && films.includes(st) ? String(st.name).replace(/\n/g, ' ') : undefined;
  };
  function composeStripLabeled(frames, startNum) {
    const label = edgeLabel();
    state.lastStripLabel = label ?? null;
    return Engine.composeStrip(frames, startNum, label);
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
    document.querySelectorAll('.roll-item.sel').forEach((n) => n.classList.remove('sel'));
    const p = state.photos[i];
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
    if (state.s.mode === 'strip') {
      const g = groupOf(p, state.s.stripN);
      parts.push(g >= 0 ? `strip ${g + 1} of ${stripGroups(state.s.stripN).length}` : 'not on a strip');
    }
    $('#frameInfo').replaceChildren(el('b', null, `${String(state.sel + 1).padStart(2, '0')} / ${String(state.photos.length).padStart(2, '0')}`), '  ·  ' + parts.join('  ·  '));
  }

  let previewQueued = false, previewRunning = false;
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
      toast('Preview failed: ' + e.message);
    } finally {
      previewRunning = false;
      $('#spinner').classList.remove('on');
    }
  }
  async function renderPreview() {
    const p = state.photos[state.sel];
    if (!p || p.remembered) return;
    const s = state.s;
    let out;
    const inStrip = s.mode !== 'strip' || groupOf(p, s.stripN) >= 0;
    if (s.mode === 'strip') {
      const g = groupOf(p, s.stripN);
      const group = g >= 0 ? stripGroups(s.stripN)[g] : [p];
      const frames = [];
      for (const q of group) {
        frames.push(Engine.renderLook(await getSource(q), q, s, STRIP_PREV_EDGE, stripAspect(s)));
      }
      out = composeStripLabeled(frames, g >= 0 ? g * s.stripN + 1 : 1);
    } else {
      const src = await getSource(p);
      out = applyFrameLabeled(Engine.renderLook(src, p, s, PREV_EDGE), s, state.sel);
    }
    showCanvas(out);
    state.lastOut = out;
    $('#viewHint').hidden = inStrip;
    updateFrameInfo();
  }
  function showCanvas(c) {
    const pv = $('#preview');
    pv.width = c.width;
    pv.height = c.height;
    pv.getContext('2d').drawImage(c, 0, 0);
  }

  // ---------- full-resolution renders ----------
  async function renderSingleFull(p, s) {
    const bmp = await decode(p);
    try { return applyFrameLabeled(Engine.renderLook(bmp, p, s, s.maxEdge || Infinity), s, p.idx); }
    finally { bmp.close(); }
  }
  async function renderStripFull(gi, s) {
    const group = stripGroups(s.stripN)[gi];
    const edge = s.maxEdge ? Math.min(s.maxEdge, 2400) : 2000;
    const frames = [];
    for (const q of group) {
      const bmp = await decode(q);
      try { frames.push(Engine.renderLook(bmp, q, s, edge, stripAspect(s))); } finally { bmp.close(); }
    }
    return { canvas: composeStripLabeled(frames, gi * s.stripN + 1), group };
  }

  // ---------- size estimate ----------
  // Encode under the optional size cap. JPG/WebP: binary-search the quality,
  // floor 10, and ship the largest quality that fits (the quality-10 result if
  // nothing does). PNG is lossless, so the cap is honored by downscaling the
  // long edge in 10% steps to 50%, then shipping that.
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
    const seq = ++estSeq, s = { ...state.s };
    try {
      let canvas, before;
      if (s.mode === 'strip') {
        const r = await renderStripFull(Math.max(0, groupOf(state.photos[state.sel], s.stripN)), s);
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
      if (seq === estSeq) $('#estOne').textContent = '—';
    }
  }

  // ---------- develop ----------
  function setBusy(on) {
    state.busy = on;
    for (const id of ['#developBtn', '#saveOneBtn', '#loadBtn', '#emptyLoad']) $(id).disabled = on;
    if (on) $('#developBtn').textContent = 'DEVELOPING…';
    else updatePickUI();
  }
  const setProgress = (f) => { $('#progressBar').style.width = Math.round(f * 100) + '%'; };

  async function develop(onlyCurrent) {
    if (state.busy || !state.photos.length) return;
    if (state.photos.some((p) => p.remembered)) { toast('This roll is remembered by name only. Re-pick the folder to restore it.'); return; }
    const s = { ...state.s }, folder = safeFolder(s.folder);
    const strip = s.mode === 'strip';
    const cur = state.photos[state.sel];
    const jobs = strip
      ? (onlyCurrent ? [groupOf(cur, s.stripN)].filter((g) => g >= 0) : stripGroups(s.stripN).map((_, i) => i))
      : (onlyCurrent ? [state.sel] : sequence().map((p) => p.idx));
    if (!jobs.length) { toast('This shot isn’t on a strip yet. Pick it first (Space or ○).'); return; }
    setBusy(true);
    setProgress(0);
    clearTimeout(estTimer);
    estSeq++;
    let before = 0, after = 0, done = 0;
    try {
      if (api.beginBatch) await api.beginBatch(folder); // first await: still inside the click, so the browser may ask for folder access
      const fmt = EXT[s.format] ? s.format : 'image/jpeg';
      const ext = EXT[fmt];
      for (const j of jobs) {
        let canvas, group, name;
        if (strip) {
          ({ canvas, group } = await renderStripFull(j, s));
          name = `strip_${String(j + 1).padStart(3, '0')}.${ext}`;
        } else {
          const p = state.photos[j];
          group = [p];
          canvas = await renderSingleFull(p, s);
          name = p.name.replace(/\.jpe?g$/i, '') + '.' + ext;
        }
        const blob = await encodeFits(canvas, { ...s, format: fmt });
        canvas.width = canvas.height = 0;
        let bytes = await blob.arrayBuffer();
        if (s.keepExif && fmt === 'image/jpeg') bytes = Exif.stamp(new Uint8Array(bytes), group[0].date).buffer;
        await api.writeFile(folder, name, bytes, fmt);
        before += group.reduce((a, q) => a + q.size, 0);
        after += blob.size;
        done++;
        if (!strip) { group[0].out = blob.size; updateItem(group[0]); }
        setProgress(done / jobs.length);
        setLcd(jobs.length - done);
        $('#devNote').textContent = `Developing ${done} / ${jobs.length}…`;
        await yieldUI();
      }
      const downloaded = api.endBatch ? await api.endBatch() : null;
      const what = strip ? 'strip' : 'photo';
      const msg = `Developed ${done} ${what}${done === 1 ? '' : 's'} · ${fmtBytes(before)} → ${fmtBytes(after)} (${pct(after / before)})`;
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

  // ---------- compare ----------
  async function showOriginal() {
    const p = state.photos[state.sel];
    if (p) showCanvas(await getSource(p));
  }
  function hideOriginal() { if (state.lastOut) showCanvas(state.lastOut); }

  // ---------- wiring ----------
  window.__darkroom = { loadRoll, develop, applyStock, togglePick, setPicks, state, exportFilm, importFilm }; // debugging / smoke tests
  buildStocks();
  buildSliders();
  bindControls();
  syncControls();
  showRememberedRoll();

  $('#loadBtn').onclick = pickFolder;
  $('#emptyLoad').onclick = pickFolder;
  $('#rememberLoad').onclick = pickFolder;
  $('#prevBtn').onclick = () => select(state.sel - 1);
  $('#nextBtn').onclick = () => select(state.sel + 1);
  $('#developBtn').onclick = () => develop(false);
  $('#saveOneBtn').onclick = () => develop(true);
  $('#pickAll').onclick = () => setPicks(state.photos.map((p) => p.idx));
  $('#pickNone').onclick = () => setPicks([]);

  // ---------- film studio ----------
  let filmDlgMode = 'save';
  function openFilmDlg(mode) {
    filmDlgMode = mode;
    $('#filmDlgTitle').textContent = mode === 'import' ? 'IMPORT FILM' : mode === 'rename' ? 'RENAME FILM' : 'SAVE FILM';
    $('#filmSaveFields').hidden = mode === 'import';
    $('#filmImportFields').hidden = mode !== 'import';
    $('#filmJson').value = '';
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
      const r = importFilm($('#filmJson').value);
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
  $('#importFilmBtn').onclick = () => openFilmDlg('import');
  $('#saveFilmBtn').onclick = () => openFilmDlg('save');
  $('#renameFilmBtn').onclick = () => openFilmDlg('rename');
  $('#saveOverBtn').onclick = saveOverFilm;
  $('#deleteFilmBtn').onclick = deleteFilm;
  $('#filmCancel').onclick = () => $('#filmDlg').close();
  $('#filmOk').onclick = onFilmOk;
  $('#filmFile').onchange = async () => {
    const f = $('#filmFile').files[0];
    if (f) $('#filmJson').value = await f.text();
  };
  const cmp = $('#compareBtn');
  cmp.addEventListener('pointerdown', showOriginal);
  for (const ev of ['pointerup', 'pointerleave']) cmp.addEventListener(ev, hideOriginal);

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type=text], select')) return;
    if (e.key === 'ArrowLeft') { select(state.sel - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { select(state.sel + 1); e.preventDefault(); }
    if (e.key === ' ' && !e.target.matches('button, input')) { togglePick(state.sel); e.preventDefault(); }
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
      // web: openDrop must be called before any await, while the dropped items are still readable
      if (api.openDrop) { await loadRoll(await api.openDrop(e.dataTransfer)); return; }
      const p = api.pathForFile(e.dataTransfer.files[0]);
      if (p) await loadRoll(await api.openDir(p));
    } catch (err) { toast('Could not open: ' + err.message); }
  });

  // ---------- service worker (web builds only) ----------
  // Registered only in secure contexts with SW support, so file:// and plain
  // non-SW browsers skip this silently. The relative URL keeps the registration
  // correct under any deploy base path (GitHub Pages serves this app at /photoset/).
  // Failures (blocked worker, unsupported browser) must never break the app.
  if (isWeb && window.isSecureContext && 'serviceWorker' in navigator) {
    // The page reloads ONLY after the user clicked the update toast; a
    // controllerchange from a first activation (or a background update) never
    // triggers a reload on its own.
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
      // A worker already waiting when the page loads (user ignored the toast
      // earlier) gets the toast again.
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          // A worker can only be "installed and waiting" while an older worker
          // is still in control, which is exactly the toast case.
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    }).catch(() => { /* offline helpers are optional */ });
  }
})();
