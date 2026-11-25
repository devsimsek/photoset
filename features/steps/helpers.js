// Shared helpers for the BDD steps. They drive the app through the surfaces a
// real session uses: window.api (the bridge) and window.__darkroom (app state).

// All quoted strings in a step text:  "a", "b" and "c"  →  ['a', 'b', 'c']
export function quoted(text) {
  return [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// Loads a roll through api.fromFiles and window.__darkroom.loadRoll, building
// real JPEG bytes in the page. specs: [{ name, rel? }] where rel is the fake
// webkitRelativePath a browser would report for folder picks.
export async function loadRoll(page, specs, rollName) {
  await openApp(page);
  return page.evaluate(async ({ specs, rollName }) => {
    const makeJpeg = async () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 48;
      const x = c.getContext('2d');
      x.fillStyle = '#b34d2e';
      x.fillRect(0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      return new Uint8Array(await blob.arrayBuffer());
    };
    const files = [];
    for (const s of specs) {
      const f = new File([await makeJpeg()], s.name, { type: 'image/jpeg' });
      if (s.rel) Object.defineProperty(f, 'webkitRelativePath', { value: s.rel });
      files.push(f);
    }
    const roll = window.api.fromFiles(files, rollName || '');
    await window.__darkroom.loadRoll(roll);
    return window.__darkroom.state.photos.map((p) => p.name);
  }, { specs, rollName });
}

// Opens the app and waits for the bridge and app state to exist.
export async function openApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window.api && window.__darkroom));
}

const MAGIC = { jpg: [0xff, 0xd8], zip: [0x50, 0x4b] };

export function startsWithMagic(buf, kind) {
  return buf.length >= 4 && buf[0] === MAGIC[kind][0] && buf[1] === MAGIC[kind][1];
}

// Minimal parse of the app's zip output: stored (uncompressed) entries, local
// headers with no extra fields, followed by the central directory.
export function zipEntries(buf) {
  const entries = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const size = buf.readUInt32LE(p + 18);
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString('utf8');
    const data = buf.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    entries.push({ name, data });
    p += 30 + nameLen + extraLen + size;
  }
  return entries;
}
