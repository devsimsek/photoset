# ADR 0001: Web-only scope

Date: 2026-11-25 · Status: Accepted (commit `fd60baf`)

## Context

Photoset Darkroom shipped as two builds from one renderer: an Electron desktop
app for Windows and a static web app for GitHub Pages. Electron duplicated the
packaging story (installer, updater, code signing, a second release channel)
for a product whose core promise, "photos never leave the device", the browser
already keeps. The web build also matched the project's size discipline better:
no runtime dependencies against Electron's hundreds of megabytes.

## Decision

The project is web-only. Electron is stripped: no main process, no IPC, no
installer, no `dist` target. `src/renderer/` is the product, assembled by
`build/build-web.js` into the static site in `web-dist/`. The `window.api`
bridge survives as the seam: `web-api.js` defines it, `app.js` consumes only
`window.api`, so a different backend (desktop, server) can return later without
touching UI code.

## Consequences

- One release path: GitHub Pages from `main`. No installer, no signing, no
  updater.
- Saving differs per browser. Chrome/Edge save into a subfolder of the roll
  folder (File System Access API); Firefox, Safari and phones download one JPG
  or a zip, with the batch held in memory until the zip builds.
- No native features: no "open folder" button after a download-mode save, no
  file-system-wide access, no offline app yet (PWA is planned for v0.3.0).
- Browser support becomes a product surface, documented in the user guide.
