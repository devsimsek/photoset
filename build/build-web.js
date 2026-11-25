// Assembles the static web app (GitHub Pages) into web-dist/. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'renderer');
const out = path.join(root, 'web-dist');
const FILES = ['index.html', 'styles.css', 'engine.js', 'exif.js', 'web-api.js', 'app.js', 'icon.png', 'manifest.webmanifest', 'sw.js'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const from = path.join(src, f);
  if (!fs.existsSync(from)) throw new Error(`missing ${f} — run "node build/make-icon.js" first if it is icon.png`);
  fs.copyFileSync(from, path.join(out, f));
}

// The service worker gets a build version injected so its precache name
// changes with the build; the browser reinstalls the SW whenever it differs.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const stamp = Date.now().toString(36);
const swPath = path.join(out, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('__BUILD_VERSION__', `${pkg.version}-${stamp}`));
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // serve files as-is
const kb = FILES.reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1024;
console.log(`web build ready in web-dist/ (${FILES.length} files, ${Math.round(kb)} KB)`);
