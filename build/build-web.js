// Assembles the static web app (GitHub Pages) into web-dist/. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'renderer');
const out = path.join(root, 'web-dist');
const FILES = ['index.html', 'styles.css', 'engine.js', 'exif.js', 'web-api.js', 'app.js', 'icon.png', 'icon-maskable.png', 'manifest.webmanifest', 'sw.js'];

// Files of the flashraw decoder (ADR 0004): the versions of the JS glue and
// the .wasm binaries the installed flashraw package ships. The decoder loads
// lazily from web-dist/flashraw/, never from a CDN.
const FLASHRAW = 'flashraw';
const pkgDir = path.dirname(require.resolve('flashraw/package.json'));
const FLASHRAW_DIST = [
  'browser.js', 'core.js', 'errors.js', 'threads.js',
  'worker.browser.js', 'worker-protocol.js', 'worker-entry.browser.js',
  'flashraw_bindgen.js', 'flashraw_bindgen_jxl.js',
  'flashraw_simd.wasm', 'flashraw.wasm', 'flashraw_simd_jxl.wasm',
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const from = path.join(src, f);
  if (!fs.existsSync(from)) throw new Error(`missing ${f} — run "node build/make-icon.js" first if it is icon.png`);
  fs.copyFileSync(from, path.join(out, f));
}
// The decoder directory ships only when the package is installed; its exact
// contents are checked so a flashraw upgrade that renames files fails the
// build loudly instead of 404ing at runtime.
const frOut = path.join(out, FLASHRAW);
fs.mkdirSync(frOut, { recursive: true });
for (const f of FLASHRAW_DIST) {
  const from = path.join(pkgDir, 'dist', f);
  if (!fs.existsSync(from)) throw new Error(`flashraw dist is missing ${f} — the package layout changed, update FLASHRAW_DIST`);
  fs.copyFileSync(from, path.join(frOut, f));
}

// Test fixtures (features/fixtures/): copied so the BDD suite can fetch them
// through the real HTTP server instead of route interception, which service
// workers hide.
const fixtures = path.join(root, 'features', 'fixtures');
const fixturesOut = path.join(out, 'fixtures');
fs.mkdirSync(fixturesOut, { recursive: true });
for (const f of fs.readdirSync(fixtures)) {
  if (path.extname(f) !== '.dng') continue;
  fs.copyFileSync(path.join(fixtures, f), path.join(fixturesOut, f));
}

// The service worker gets a build version injected so its precache name
// changes with the build; the browser reinstalls the SW whenever it differs.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const stamp = Date.now().toString(36);
const swPath = path.join(out, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replaceAll('__BUILD_VERSION__', `${pkg.version}-${stamp}`));
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // serve files as-is
const kb = FILES.reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1024;
let decoderKb = 0, decoderFiles = 0;
for (const f of fs.readdirSync(path.join(out, FLASHRAW))) {
  decoderKb += fs.statSync(path.join(out, FLASHRAW, f)).size / 1024;
  decoderFiles++;
}
const fixturesKb = fs.readdirSync(path.join(out, 'fixtures')).reduce((a, f) => a + fs.statSync(path.join(out, 'fixtures', f)).size, 0) / 1024;
console.log(`web build ready in web-dist/ (${FILES.length} files, ${Math.round(kb)} KB app, decoder: ${decoderFiles} files ${Math.round(decoderKb)} KB, fixtures: ${Math.round(fixturesKb)} KB)`);
