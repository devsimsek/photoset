// Local preview of the web build: node build/serve-web.js  →  http://localhost:5178
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'web-dist');
const port = Number(process.env.PORT) || 5178;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    // A malformed URL (%zz) must answer 400, not kill the process.
    res.writeHead(400);
    return res.end('bad request');
  }
  const file = path.join(root, rel === '/' ? 'index.html' : rel);
  // Exact-prefix check: a bare startsWith lets a sibling directory whose name
  // extends the root (web-dist-backup) pass the gate.
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`Photoset Darkroom (web) at http://localhost:${port}`));
