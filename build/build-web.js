// Assembles the static web app (GitHub Pages) into web-dist/. No dependencies.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'renderer');
const out = path.join(root, 'web-dist');
const FILES = ['index.html', 'styles.css', 'engine.js', 'web-api.js', 'app.js', 'icon.png', 'manifest.webmanifest'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const from = path.join(src, f);
  if (!fs.existsSync(from)) throw new Error(`missing ${f} — run "node build/make-icon.js" first if it is icon.png`);
  fs.copyFileSync(from, path.join(out, f));
}
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // serve files as-is
const kb = FILES.reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1024;
console.log(`web build ready in web-dist/ (${FILES.length} files, ${Math.round(kb)} KB)`);
