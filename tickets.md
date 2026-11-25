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

## Future waves (planned, not ticketed yet)

Ticketing happens when a wave starts. Scope may shift before then.

| Version | Theme |
| --- | --- |
| v0.1.0 | Export options |
| v0.2.0 | Film studio |
| v0.3.0 | PWA |
| v0.4.0 | Local storage / rolls |
| v0.5.0 | Mobile + QOL |
| v0.6.0 | RAW processing |
| v1.0.0 | 1.0 |
