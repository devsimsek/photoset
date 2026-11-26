# ADR 0005: Build minification

Date: 2026-11-26 · Status: Accepted (owner decision)

## Context

The bundle ratchet (150 KiB JS+CSS+HTML, never raised) reached 149.5 KiB after
v1.1. The v1.2 wave needs real headroom: the vendored PDF writer alone adds
5-10 KB readable. Three paths existed: lazy-loading the PDF module (the decoder
precedent), minifying at build time, or raising the ceiling. Raising the ceiling
was off the table by law.

## Decision

Minify at build time with **esbuild** as a devDependency. `build/build-web.js`
minifies the copied JS and CSS in place before serving or deploying; the BDD
suite and the Pages deploy both consume the minified bytes, so tests always
exercise exactly what ships. Source stays readable in `src/renderer/`; nobody
hand-edits `web-dist/`.

First build dependency in the project's history (the one runtime dependency
remains flashraw, ADR 0004). The owner picked this over lazy-loading (option a)
and over raising the ratchet (option c, banned).

## Consequences

- The ratchet now measures minified output; the ceiling stays 150 KiB and is
  not raised.
- Minified code must keep the test hooks working: esbuild does not mangle
  property names, so `window.__darkroom`, `__intakeLog`, and `api._lastDownload`
  survive. The BDD suite proves it on every push.
- The sw version injection (`__BUILD_VERSION__` string replace) runs after
  minification; esbuild preserves string literals.
- Stack traces in production lose readable names. Accepted: the app ships no
  error-reporting pipeline that would consume them.
- `npm ci` in CI downloads the esbuild binary; the dependency is pinned exact.
