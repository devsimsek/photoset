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
| PS-13 | Film library: save, rename, delete, edit reopens, persistence | Done | `app.js`, features/ | Commit `7809e9c`. Red proof: 7 failed pre-impl. 32/32 green. `darkroom.films` localStorage, re-validated on load; built-ins never mutate; byte-identical develop after reload (grain-0 film; grain was unseeded then, seeded since PS-33). |
| PS-14 | Studio editor UI + film name on the strip edge print | Done | `app.js`, `engine.js`, `index.html`, `styles.css` | Commit `826a02c`. Red proof: 1 failed pre-impl. 35/35 green. `composeStrip` label param, default 'PHOTOSET 400' unchanged; custom films print their name. |
| PS-15 | MkDocs theme: switch Material to shadcn | Done | `mkdocs.yml`, `.github/workflows/pages.yml` | Commits `39b25b8` (ci) + `4ffafe4` (theme). Strict shadcn build exit 0. Note: three Pages deploys failed mid-wave with 'Unrecognised theme name: material' (CI installed shadcn before mkdocs.yml switched); fixed forward by PS-15. |
| PS-15a | AGENTS.md refresh for new commands/contracts | Done (on disk, no commit) | `AGENTS.md` (on disk, no commit) | Owner policy: gitignored. Refreshed through Wave 7: rolls, films, sw version injection, grain non-determinism, batch error shape, keyboard, paste, flashraw as the one runtime dependency. |

## Wave 4, v0.3.0: PWA / offline

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-16 | Service worker: precache the shell, network-first updates | Done | `sw.js` (new), `app.js`, `build-web.js`, features/ | Commit `3bc4220`. Red proof: offline loads failed pre-impl. 38/38 green. Cache `photoset-shell-<version>`, version injected by `build-web.js`; activate deletes old caches. |
| PS-17 | Update toast: skip-waiting + reload button, never forced | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `404d6dd`. Red proof: toast timeout pre-impl. 41/41 green. Reload only on user click; version-swap simulation swaps the built sw.js VERSION mid-scenario. |
| PS-18 | Installability: manifest audit, maskable icons, install UX | Done | `manifest.webmanifest`, `make-icon.js`, `app.js`, features/ | Commit `638a4a8`. Red proof: short_name and 512 maskable icon missing. 44/44 green. `icon-maskable.png` generated via `make-icon.js` (not hand-edited); apple-touch-icon added; latent `replace`-vs-`replaceAll` version-injection bug found and fixed in this commit. |

## Wave 5, v0.4.0: local storage / rolls

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-19 | Persistence upgrade: films, settings, roll metadata (pixels never) | Done | `app.js`, `web-api.js`, features/ | Commit `b6c85a4`. Red proof: 4 failed pre-impl. `darkroom.roll` metadata only; remembered-roll state with re-pick banner; storage-size scenario pins pixels-never. 48/48 at commit. |
| PS-20 | Roll relink: re-pick folder auto-matches by name, numbering continues | Done | `app.js`, `web-api.js`, features/ | Commit `a38fbcb`. Red proof: 3 failed pre-impl. Half-match threshold; `strip_004` remembered -> next batch `strip_005`; picks restore by file name; phantom picks for vanished files dropped. 51/51 at commit. |
| PS-21 | Non-matching files flagged in the photo list | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `d2d456d`. Red proof: 3 failed pre-impl. 54/54 final. Dimmed rows with MISSING badge; batch and strip grouping skip them; different folder replaces memory wholesale. |

## Wave 6, v0.5.0: mobile + QOL

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-22 | 375px layout pass, touch targets at least 44px | Done | `styles.css`, `index.html`, features/ | Commit `3d46ae9`. Red proof: 38.8px develop button, 18px slider input pre-impl. 44px targets across controls; hit-area ::after for links. 57/57 at commit. |
| PS-23 | Keyboard navigation between photos (arrows, j/k) | Done | `app.js`, `index.html`, features/ | Commit `7d1ea4b`. Red proof: ArrowDown and j left selection unmoved. All arrows + j/k, Enter develops, Escape closes, typing guard covers input/textarea/select/[contenteditable]. 64/64 at commit. |
| PS-24 | Paste photo from clipboard | Done | `app.js`, `web-api.js`, features/ | Commit `33e5604`. Red proof: paste a complete no-op pre-impl. JPEG as-is, PNG canvas-converted to JPG, others refused by name; joins remembered roll; starts "pasted" roll. 69/69 at commit. |
| PS-25 | Batch error reporting: per-file errors listed, not swallowed | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `b8793c0`. Red proof: batch aborted at first failure pre-impl. 71/71 final. Per-job try/catch; summary toast `Developed 2, failed 1: bad.jpg (reason)`; successful batches unchanged. |

## Wave 7, v0.6.0: RAW processing (per ADR 0004)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-26 | Decoder integration: FlashRaw lazy-loaded, self-hosted in web-dist | Done | `package.json`, `web-api.js`, `sw.js`, `build-web.js`, features/ | Commit `c7e7b66`. Red proof: decodeRaw absent pre-impl. `flashraw@0.5.0` pinned exact, first runtime dependency. Decoder dist copied into `web-dist/flashraw/` (list derived from the installed package); sw serves it cache-first into `photoset-decoder-<version>`, filled on first fetch, never install-precached. Offline second decode proven. |
| PS-27 | RAW load path: DNG/CR3/ARW accepted, instant embedded preview, progress, abort | Done | `app.js`, `web-api.js`, `engine.js`, features/ | Commit `620db25`. Red proof: 4 failed pre-impl. Loaders accept .dng/.cr3/.arw; embedded preview instant, decode-on-demand then drop; roll change aborts via AbortController (proved by stats counting). Fixture: CC0 Blackmagic CinemaDNG + appended preview SubIFD, checksums in features/fixtures/README.md. Keep-EXIF for RAW writes the capture date when metadata carries one (fixture has none). |
| PS-28 | Latency measurement + ADR 0004 verification (24 MP target) | Done | `docs/adr/0004-raw-decoding.md`, `docs/laws.md`, `docs/user-guide.md`, `docs/internals/raw.md` | Commit `e974c31`. 24 MP Ricoh GR III: 655-674 ms warm in Chromium (budget 5 s, 7x margin). Fixture: 71 ms. ADR unverified item moved to Verified. Nav gaps for ADR 0004 + internals/raw.md fixed in `6c356c7`. Remaining unverified, recorded: CR3/ARW in-browser (no clean CC0 fixture, 20-30 MB), FlashRaw mid-decode worker cancellation, JPEG XL DNG second binary. |

## Post-1.0 QA pass (2026-11-26, adversarial review)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-29 | Dev server hardening + em dash sweep | Done | `build/serve-web.js`, `build/build-web.js`, `src/renderer/*` | Commits `2abc02c` + `8faf951`. Probe evidence: `GET /%zz` killed the process (URIError, uncaught in handler); now 400 and alive. Sibling dir read via `startsWith(root)` prefix bug (`web-dist-backup` served through `/../`); now root+sep check, 403. Ten em dashes removed from source and shipped strings. |
| PS-30 | A 404 page never replaces the offline shell | Done | `sw.js`, features/ | Commit `fc99daf`. Red proof: after one navigation to a missing URL, offline boot served 'not found' (probe + failing scenario). GitHub Pages serves a full HTML 404, so any broken link poisoned installed apps. Navigate branch caches only `fresh.ok`. 82/82 green. |

## Future waves (planned, not ticketed yet)

Ticketing happens when a wave starts. Scope may shift before then.

| Version | Theme |
| --- | --- |
| v0.3.0 | PWA (done) |
| v0.4.0 | Local storage / rolls (done) |
| v0.5.0 | Mobile + QOL (done) |
| v0.6.0 | RAW processing (done) |
| v1.0.0 | 1.0 (done) |

## v1.0.2 hotfix: mobile intake hardening (2026-11-26)

First real-world report: a folder with a whole phone's photos "didn't fully open"
(Muhsin, phone). Repro on the owner's device passed; the hardening ships blind and
PS-32 keeps the device triage. Source: ~/.opencode/plan/photoset-post-1.0-waves.md

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-31 | Mobile load hardening: lazy tiles, batched metadata, progress, honest errors | Done | `web-api.js`, `app.js`, `index.html`, `styles.css`, features/ | Commit `1dcb2d1`. Red proof: 4 failed pre-impl (no intake line, unnamed preview toast). 86/86 green. Chunked metadata reads (max 64 concurrent, was 300 at once via Promise.all), lazy thumbs keyed to rendered tiles, `#intakeLine` progress, per-shot named failure toasts. Batching pinned by real drop-handler probes with a fake folder entry. |
| PS-32 | Phone repro triage (backlog, device needed) | Open | investigation | Owner reports the same path works for him; record both outcomes on a real device when available. |

## v1.1: faithful films (planned)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-33 | Deterministic grain (byte-exact develop law) | Done | `engine.js`, docs | Commit `016a01e`. Red proof: byte-equality scenario failed pre-impl (Math.random). grain() draws the seeded stream; instant paper grain uses a constant seed. AGENTS.md gotcha and engine.md paragraph updated at integration. |
| PS-34 | Full EXIF carry; GPS stays default-off | Done | `exif.js`, `app.js`, docs | Commit `aadc5f7`. Red proof: Make/Model and GPS scenarios failed pre-impl. Three-IFD writer (IFD0 + Exif + GPS); writer and checker are independent implementations. GPS toggle default off, law in docs/laws.md. |
| PS-35 | Web Share Target: share photos into Photoset | Done | `manifest.webmanifest`, `sw.js`, `app.js`, features/ | Commit `0897f9d`. Red proof: no share_target, no launch consumer. Deviation with sources: files require POST + multipart per Chrome's documented contract, not the GET the ticket sketched; SW answers the POST with a redirect and hands files to the paste intake. |
| PS-36 | Film as URL + QR (rides on PS-33) | Done | `app.js`, `qr.js` (new), features/ | Commit `1b0a0f7`. Red proof: 4 failed pre-impl. QR encoder verified module-for-module against nayuki's C reference at all 8 masks plus jsQR decode of 6 payloads (caught a bogus alignment pattern and transposed format bits pre-ship). Byte-identical develop asserted across a shared link. 100/100 final. |

## v1.2: darkroom print (planned)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-38 | Contact-sheet PDF export | Done | `app.js`, `index.html`, features/ | Commit `9299559`. Red proof: 6 failed pre-impl (printContactSheet absent). A4 portrait, max 2 strips per page, proof edges at 1200 px q75 (measured: 1600/80 hit 8.2 MB on pathological noise, tightened). 12-shot roll: 0.65 MB photographic, 5.04 MB worst case. Prints to prints/ or download through the normal never-overwrite path; never advances the strip high-water mark. 128/128 final. |
| PS-37 | Vendored minimal PDF writer + ADR 0005 | Done | `pdf.js` (new), `build-web.js` FILES, `index.html`, features/ | Commit `b2dd39b`. Red proof: 4 failed pre-impl (Pdf undefined). PDF 1.4, A4, DCTDecode JPEG passthrough, core fonts, ASCII escaping; xref offsets verified by the suite's own parser. ~2.5 KB minified, zero dependencies. ADR 0005 (minification) committed separately at `62f33be`; this ADR covers the writer's scope. |
| PS-38 | Contact-sheet PDF export | Done | `app.js`, `index.html`, features/ | Commit `9299559`. Red proof: 6 failed pre-impl (printContactSheet absent). A4 portrait, max 2 strips per page, proof edges at 1200 px q75 (measured: 1600/80 hit 8.2 MB on pathological noise, tightened). 12-shot roll: 0.65 MB photographic, 5.04 MB worst case. Prints to prints/ or download through the normal never-overwrite path; never advances the strip high-water mark. 128/128 final. |
| PS-39 | Rotate 90 degrees | Done | `engine.js`, `app.js`, features/ | Commit `5fad6f0`. Red proof: 5 failed pre-impl. Rotation before aspect crop (landscape turns to portrait under 3:2); optional `rotate` schema key with default 0, v1 films still import (pinned). 105/105 at commit. |
| PS-40 | Free crop | Done | `engine.js`, `app.js`, roll metadata | Commit `3eb2efc`. Red proof: 5 failed pre-impl. One coordinate space: fractions of the ROTATED frame, documented in renderLook's contract comment; crop survives reload and relink; composes with rotation and aspect. 111/111 at commit. |
| PS-41 | Half-frame mode | Done | `engine.js`, `app.js` | Commit `a9f0e50`. Red proof: 4 failed pre-impl. `N A / N B` edge print convention, odd final shot composes alone; shares the roll's strip numbering and high-water mark. 115/115 at commit. |
| PS-42 | Sprocket-panorama mode | Done | `engine.js` | Commit `512ddf8`. Red proof: 3 failed pre-impl. composeStrip sprocket geometry inverted into the picture, 3:1 ratio forced; pixel-probe pinned. Comment-budget pass on sw.js adopted separately (`6a0f5e0`, verified comment-only). 118/118 at commit. |
| PS-43 | SBOM per release tag (CycloneDX) | Done | `build/sbom.js`, `package.json`, `pages.yml`, mkdocs nav | Commit `62f33be`. Hand-rolled CycloneDX 1.5 generator (42 components: lockfile tree + first-party engine/qr/exif/zip); ships as /sbom.cdx.json with every deploy, live and parsing. Version drift found while wiring it: package.json read 0.0.1 through seven tags; bumped to 1.1.0, lockstep with tags is now the contract. |

## v1.3: colorist / LUT (planned)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-44 | ADR 0006: LUT design | Open | docs/adr | |
| PS-45 | .cube import | Done | `cube.js` (new), `app.js`, features/ | Commit `af38c01`. Red proof: 9 failed pre-impl (stock missing, tint probe, refusals answered "not JSON"). Parser per ADR 0006: 3D only, sizes 17-65, exact row count, default-domain only, refusals by name. Identity cube develops byte-identical to no-LUT for all N in 17..65 (verified numerically pre-ship). 148/148 at commit. |
| PS-46 | .cube export (v1 grade baked in) | Done | `app.js`, features/ | Commit `ed9309c`. Red proof: 3 failed pre-impl (no export control). Bake = full grade G at every lattice point in engine order, 6-decimal floats, explicit DOMAIN, red fastest. Tolerances pinned on lossless PNG compares with a busy shot: grade-only <= 2/255 (measured worst 2), LUT-carrying <= 4/255 (measured worst 3). Export cube size fixed at 33. Fixed a base64 chunking bug found during the round-trip (chunk not a multiple of 3 broke `atob` for sizes >= 23; new 33-point import scenario rode in this commit). 152/152 final. |
| PS-47 | Film schema v2 + migration (v1 imports forever) | Done | `app.js`, `web-api.js`, features/ | Commit `2223beb`. Red proof: 7 failed pre-impl. Schema law held: v1 imports unchanged, v2 adds optional root `lut`. Fixed a pre-existing latent bug the library scenario exposed: settings-restore called stockById before init (TDZ) and the catch swallowed it, so the active film stock never survived a reload. CI had one runner-install flake on the SHA (exit 100, never reached tests), rerun green. |
| PS-48 | 3D interpolation in the engine | Done | `engine.js` | Commit `7fc6b12`. Red proof: tinted probe failed (blue 128 vs ~192) with the pass unwired. Trilinear per ADR 0006 (tetrahedral cut, measured within 7%); own getImageData/putImageData step after grade, before leak; 12 MP with 17-cube: 334 ms (budget 10 s). Identity, reproducibility, and latency pins ride green-on-arrival as guards. |

## v1.3.1 hotfix: Safari folder pick + crop feedback (2026-11-27)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-49 | Safari's folder picker refuses single files | Done | `web-api.js`, features/ | Commit `375005b`. Root cause cited: WebKit bug 284457 (files selectable inside a folder, then an empty list read as cancel). Folder input accepts '..' so Safari grays files out; phone filter untouched per owner directive, pinned. FSA failures other than SecurityError/TypeError fall back to the input picker. My own first edit had a TDZ (accept referenced folderMode before its declaration); the new scenarios caught it before landing. 155/155 final. |
| PS-50 | The crop control explains itself | Done | `app.js`, features/ | Commit `e5df9db`. Dead click on no-selection / remembered placeholder now toasts the reason; pinned against a seeded remembered roll. CSP console note resolved as not-ours: the page ships zero inline scripts; the blocked inline script is a browser extension hitting our strict CSP. |
| PS-51 | The version-swap check waits for the swap | Done | features/steps/pwa.js | Commit `548fe40`. Second CI occurrence of the recorded flake (controller still old after reload click); root cause read from the step: five zero-delay retries raced the navigation. Now 20 polls x 500ms settling. Tag v1.3.2; the recording-the-fix-shape-instead-of-fixing era ends here. |

## v1.4.2/v1.4.3: the swatch revert and the hermetic swap (2026-11-27)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-57 | The stocks list keeps its colour swatches | Done | `app.js`, `styles.css`, `docs/user-guide.md`, features/ | Commit `6e74758`. Owner decision after v1.4: the PS-54 photo thumbnails go, the button is the film's identity. Preview engine removed (163 lines); scenarios pin zero canvases with a 2s settle so they cannot pass by checking before the old paint window. 179/179. |
| PS-58 | The update swap runs on a private origin | Done | features/ | Commit `0f83ad2`. Third CI occurrence of the swap stick, mechanism proven: fullyParallel false serializes within a file, but 29 spec files run in parallel across workers sharing the 5179 origin (one registration, one sw.js). The swap scenarios now own a random-port server serving a web-dist COPY: isolated registration, bytes, caches. 179/179, CI green with parallel workers. |
| PS-59 | The shell is atomic | Done | `sw.js`, features/ | Commit `175138f`. Owner-reported rotation death + empty rotate select + the swap sticks share one root: network-first navigations paired a fresh index.html with cache-first old parts (mixed shell). Red scenario: a post-deploy reload carried the new page body under the old controller. Navigations now serve the cached page of the running version with a quiet throttled update check; updates arrive whole through the toast. 180/180. Tag v1.4.4. |

## v1.4: the emulsion wave (2026-11-27)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-52 | Film-shaped colour: S-curve, halation, layered grain | Done | `engine.js`, features/ | Commit `5100436`. Red proof: linear contrast slammed a 242-gray to white; halation key refused pre-impl. Smoothstep S-curve with a ~0.85 shoulder (0.95-white holds ~250 at max contrast); content-aware halation as optional look key 0-100 default 0; grain green-weighted with a density mask. Zero re-pinned values: the zero look stays byte-identical. |
| PS-53 | The Fuji-simulation pack, house-named | Done | `app.js`, features/ | Commits `2ff0bb2` + `5018573` (fix forward: the Chrome 100 faithful-slide pin read runner-unsafe). House names: Chrome 100, Portrait Silk, Velvet Chrome 50, Archive Chrome, Seventies Neg, Amber Neg, Cine Flat 400 (halation 45), Micro Mono 100. Signatures pinned per stock on PNG compares vs Clean Scan. |
| PS-54 | Every stock previews itself on the current shot | Done | `app.js`, `index.html`, `styles.css`, features/ | Commit `0f28913`. Red proof: no preview canvases existed. 96x72 renderLook thumbnails cached per (shot, stock), built over requestIdleCallback, cleared on roll/crop/library changes; preview equals a thumbnail-scale develop within 2/255 mean. |
| PS-55 | The stage bar stays inline; controls speak one language | Done | `index.html`, `styles.css`, `app.js`, features/ | Commit `dad29e3`. Red proofs: the owner-reported squeeze (frame info crushed to 0px in crop mode at 375), missing first-run hint, QR escaping the dialog (415.8 > 359). .stage-nav never wraps (120px frame-info floor), .stage-modes wraps controlled; first-run hint retired by any roll load; film dialog rows pinned. Confession in the report: the agent's first hint logic was inverted and its own scenario caught it. |

## v1.4.1 hotfix: the button audit (2026-11-27)

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-56 | The action controls sit out with a reason | Done | `app.js`, features/ | Commit `a89f953`. Owner report: PRINT PDF did nothing. Full button audit: DEVELOP, SAVE THIS, PRINT PDF, HOLD ORIGINAL and CROP were silent no-ops with no roll (the PS-50 disease, systemic). They disable with a 'Load a roll first' tooltip until pixels exist, respect busy state, keep their remembered/missing toasts; compareBtn verified wired (hold). 180/180 final. |
