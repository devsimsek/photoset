# Ticket Ledger

Photoset Darkroom work is tracked here. One ticket = one commit series, committed with an
explicit pathspec, with evidence posted back on the ticket. Agents working in parallel claim
paths and never commit outside them.

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-1 | Web-only strip (Electron removed) | Done | `package.json`, `build/`, `src/renderer/` | Commit `fd60baf`. Build clean, `serve:web` 200 smoke test. |
| PS-2 | Gherkin BDD harness (loading, developing, saving, naming) | Done | `features/`, playwright config, `package.json` | Commit `f2c1833`. 10 scenarios pass, 0 skipped. Re-verified 10/10 at integration. |
| PS-3 | Pages deploy + BDD gate workflows | Done | `.github/` | Commit `e58ca5b`. `actionlint` zero findings on both files, re-checked at integration. |
| PS-4 | Docs + ADRs | Done | `tickets.md`, `docs/`, `mkdocs.yml` | Commit `7d7603e`. MkDocs build zero errors incl. `--strict`. |
| PS-5 | LICENSE + README rewrite | Done | `LICENSE`, `README.md` | Commit `0ec45f0`. No desktop mentions remain. |
| PS-6 | AGENTS.md | Done (on disk, no commit) | `AGENTS.md` | Written; gitignored by owner policy, like agent instruction files in other repos. |
| PS-7 | Git repo to GitHub, Pages arming, tag v0.0.1 | Done | GitHub repo settings, Pages, tags | `gh` cli per owner instruction. Repo `devsimsek/photoset`, Pages armed (build_type=workflow), first deploy fixed (`ed5ab4c`, docs path bug) and verified: app 200, /docs/ 200. Tag `v0.0.1` pushed. |

## Wave 2, v0.1.0: export options

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-8 | Multi-format encode: PNG and WebP alongside JPG | Done | `engine.js`, `app.js`, `web-api.js`, features/ | Commit `b41e00b`. Red proof quoted (3 failed pre-impl), 14/14 green. Naming law made extension-aware; loading stays JPG-only. Safari WebP `toBlob` unverified, check on a real device. |
| PS-9 | Output panel: per-batch format, quality, size cap | Done | `app.js`, `index.html`, `styles.css` | Commit `deb6103`. Red proof quoted, 18/18 green. `encodeFits`: JPG/WebP binary-search quality; PNG downscales in 10% steps. Cap defaults off. |
| PS-10 | RAW decoder spike, ADR 0004 | Done (research) | `docs/adr/0004-raw-decoding.md` | Commits `66fb1f1` -> `2880d6a`. Decision: FlashRaw pinned exact, `libraw-wasm` fallback, DNG-only emergency. 1.27 MB gz wasm, lazy asset outside the 150 KB ratchet by ADR exception. Real-browser 24 MP latency: measure in Wave 7. |
| PS-11 | EXIF re-injector: keep EXIF option, default off | Done | `exif.js` (new), `app.js`, `index.html`, `build-web.js` FILES | Commit `bd551cf`. Red proof quoted (on-scenario), 20/20 green. APP1 writer, JPG only; WebP/PNG skip by design. |

## Wave 3, v0.2.0: film studio

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-12 | Film schema v1 + import/export (file, paste, download, copy) | Done | `app.js`, `engine.js`, `index.html`, features/ | Commit `9b64434`. Red proof: 5 failed pre-impl. 25/25 green. `validateFilm` refuses unknown schema, out-of-range sliders (SLIDERS table), non-hex colors, unknown aspect/frame/dateFmt. Docs: user-guide + internals/film-schema.md. |
| PS-13 | Film library: save, rename, delete, edit reopens, persistence | Done | `app.js`, features/ | Commit `7809e9c`. Red proof: 7 failed pre-impl. 32/32 green. `darkroom.films` localStorage, re-validated on load; built-ins never mutate; byte-identical develop after reload (grain-0 film; engine grain uses Math.random, not the seeded RNG). |
| PS-14 | Studio editor UI + film name on the strip edge print | Done | `app.js`, `engine.js`, `index.html`, `styles.css` | Commit `826a02c`. Red proof: 1 failed pre-impl. 35/35 green. `composeStrip` label param, default 'PHOTOSET 400' unchanged; custom films print their name. |
| PS-15 | MkDocs theme: switch Material to shadcn | Done | `mkdocs.yml`, `.github/workflows/pages.yml` | Commits `39b25b8` (ci) + `4ffafe4` (theme). Strict shadcn build exit 0. Note: three Pages deploys failed mid-wave with 'Unrecognised theme name: material' (CI installed shadcn before mkdocs.yml switched); fixed forward by PS-15. |
| PS-15a | AGENTS.md refresh for new commands/contracts | Open | `AGENTS.md` (on disk, no commit) | Owner policy: gitignored. Update at wave end. |

## Wave 4, v0.3.0: PWA / offline

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-16 | Service worker: precache the shell, network-first updates | Done | `sw.js` (new), `app.js`, `build-web.js`, features/ | Commit `3bc4220`. Red proof: offline loads failed pre-impl. 38/38 green. Cache `photoset-shell-<version>`, version injected by `build-web.js`; activate deletes old caches. |
| PS-17 | Update toast: skip-waiting + reload button, never forced | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `404d6dd`. Red proof: toast timeout pre-impl. 41/41 green. Reload only on user click; version-swap simulation swaps the built sw.js VERSION mid-scenario. |
| PS-18 | Installability: manifest audit, maskable icons, install UX | Done | `manifest.webmanifest`, `make-icon.js`, `app.js`, features/ | Commit `638a4a8`. Red proof: short_name and 512 maskable icon missing. 44/44 green. `icon-maskable.png` generated via `make-icon.js` (not hand-edited); apple-touch-icon added; latent `replace`-vs-`replaceAll` version-injection bug found and fixed in this commit. |

## Wave 5, v0.4.0: local storage / rolls

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-19 | Persistence upgrade: films, settings, roll metadata (pixels never) | Open | `app.js`, `web-api.js`, features/ | |
| PS-20 | Roll relink: re-pick folder auto-matches by name, numbering continues | Open | `app.js`, `web-api.js`, features/ | |
| PS-21 | Non-matching files flagged in the photo list | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `d2d456d`. Red proof: 3 failed pre-impl. 54/54 final. Dimmed rows with MISSING badge; batch and strip grouping skip them; different folder replaces memory wholesale. |

## Wave 6, v0.5.0: mobile + QOL

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-22 | 375px layout pass, touch targets at least 44px | Open | `styles.css`, `index.html`, features/ | |
| PS-23 | Keyboard navigation between photos (arrows, j/k) | Open | `app.js`, `index.html`, features/ | |
| PS-24 | Paste photo from clipboard | Open | `app.js`, `web-api.js`, features/ | |
| PS-25 | Batch error reporting: per-file errors listed, not swallowed | Open | `app.js`, `index.html`, `styles.css`, features/ | |
| PS-15 | MkDocs theme: switch Material to shadcn | Open | `mkdocs.yml`, `.github/workflows/pages.yml` | |

## Future waves (planned, not ticketed yet)

Ticketing happens when a wave starts. Scope may shift before then.

| Version | Theme |
| --- | --- |
| v0.3.0 | PWA |
| v0.4.0 | Local storage / rolls |
| v0.5.0 | Mobile + QOL |
| v0.6.0 | RAW processing |
| v1.0.0 | 1.0 |
