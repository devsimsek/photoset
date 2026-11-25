# ADR 0004: In-browser RAW decoding

Date: 2026-11-25 · Status: Accepted

## Context

Photoset Darkroom develops JPGs today. v0.6.0 adds RAW files: DNG (Adobe and
phone ProRAW), Canon CR3, Sony ARW. The decode runs entirely in the browser.
Three constraints pin the choice:

- Privacy law: pixels never leave the device. No server round trip, no decode
  API. Non-negotiable, and it rules out every service-based decoder.
- Budget: a 24 MP RAW decodes in under 5 seconds on a desktop machine. The
  decoder payload stays under 3 MB gzipped and loads lazily: the first paint
  never pays for it.
- Pipeline fit: the output feeds `engine.js` `renderLook` through the existing
  canvas pipeline. RGB(A) pixels or a canvas; no file-format side path.

The bundle ratchet (150 KB JS+CSS, never raised) governs app code. A WASM
decoder binary is an asset fetched on demand when a user opens a RAW file, not
app JS; this ADR grants it an explicit exception, sized below.

CR3 is the hard part. It is an ISO-BMFF container holding Canon's CRX codec.
LibRaw 0.21+ reads it; dcraw and most of its ports predate it and do not.
Sony ARW needs Sony lossless and ARW2 decoders. DNG is TIFF-based and the
easiest of the three, but the common DNG modes are lossless JPEG (Ricoh,
iPhone ProRAW, Pixel) and deflate, not just uncompressed strips.

## Candidates

Payloads below are measured from the published npm tarballs, not vendor
READMEs. Maintenance facts come from npm and GitHub.

| Candidate | Maintained | Payload (gzip, measured) | DNG | CR3 | ARW | API | License | Performance evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FlashRaw (ybouane) | yes: v0.5.0 published 2026-11-25, first release 2026-10-25 | 1.27 MB one `.wasm` + ~25 KB JS glue; JPEG XL variant 1.80 MB only when a JPEG XL DNG appears | yes (lossless JPEG, deflate, lossy, JPEG XL) | yes (CRX and C-RAW) | yes (lossless and ARW2) | async, worker pool, returns `rgba8` `ImageData`-compatible frame | MIT OR Apache-2.0 | vendor benchmarks: 26 MP CR3 RAW to sRGB 57.7 ms native all-core; ~100 ms for a 17 MP CR3 in the browser (vendor claim) |
| libraw-wasm (ybouane) | yes: v1.6.0 published 2026-07-02 | 484 KB `.wasm` + ~49 KB JS glue | yes | unverified in this build | yes | async in a Web Worker, `imageData()` returns RGB pixels | wrapper ISC; LibRaw itself LGPL-2.1 OR CDDL-1.0 | none published; native LibRaw measures 12-22x slower than FlashRaw in the same author's benchmarks |
| @wasmedia/wlibraw | yes: v0.3.0, 2026 | ~1.6 MB unpacked package; wasm size unmeasured | yes | claimed | yes | worker-based | LGPL-2.1-only | none published |
| rawconvert-wasm (anthonygreco) | early: v0.1.1 | ~1.2 MB unpacked package; wasm size unmeasured | yes | claimed | yes | TypeScript, browser | MIT declared, but LibRaw-derived; inherited licensing unclear | none published |
| dcraw-wasm (nhebling) | v0.0.4 | small | yes | no (dcraw core) | yes | sync-ish, converts to JPEG | "SEE LICENSE IN LICENSE" | none published |
| ImageMagick WASM builds | varies | multi-MB, unverified | unverified | unverified | unverified | general image suite | varies | none for RAW |
| Vendored minimal DNG/TIFF decoder | n/a (we would build it) | smallest of all | partial: lossless JPEG, deflate, opcodes and DCP profiles all needed | no | no | ours to design | n/a | n/a |

Notes on the LibRaw family: `libraw-wasm` and FlashRaw share one author, and
he pins a banner on the LibRaw-Wasm README recommending FlashRaw for new
projects. FlashRaw is a Rust rewrite: memory-safe parsing, fuzz targets run
before releases, allocation limits on untrusted files, and a decoder that runs
sandboxed inside WASM. It decodes 2,008 of the 2,016 files in the
raw.pixls.us corpus. CR3 CRX and C-RAW, Sony ARW lossless and ARW2, and DNG
lossless JPEG all appear in its published per-camera benchmark table with
numbers, which is the format evidence we need.

## Decision

**Primary: FlashRaw (`npm flashraw`), pinned to an exact version.**
**Fallback: `libraw-wasm` if FlashRaw becomes unmaintained or breaks a release.**
If both die: vendor a DNG-only decoder and defer CR3 and ARW. Honesty cut, not
the plan.

Config: `init()` with defaults (SIMD binary, threads when the page is
cross-origin isolated, JPEG XL `auto`). Decode with
`decode({ output: 'rgba8' })` in the worker pool, abortable through
`AbortSignal`.

## Consequences

- **Bundle impact, by exception.** FlashRaw adds one `.wasm` asset at 1.27 MB
  gzip plus about 25 KB of JS glue, fetched by dynamic import the first time a
  RAW file is opened. The 150 KB ratchet still governs app JS+CSS and is not
  raised; the `.wasm` is a lazy asset outside it. The build must copy the
  flashraw `dist/*.wasm` and glue files into `web-dist/`; the hardcoded
  `FILES` list in `build/build-web.js` applies, a new file never ships until
  it is added there.
- **JPEG XL DNGs** (DNG 1.7, mostly Samsung phones) load a second binary of
  1.80 MB gzip on first contact, putting the combined payload at ~3.07 MB gz,
  2 percent over the ceiling, and only for those files. Accepted: the payload
  rule holds for every format in scope (standard DNG, CR3, ARW) at 1.27 MB.
  `init({ jpegxl: 'never' })` restores a hard guarantee if the owner prefers
  it.
- **Integration shape.** A new `window.api` method in `web-api.js` does a
  dynamic `import('flashraw')` (or a worker pool from `flashraw/worker`),
  decodes to `rgba8`, and `putImageData`s it into a canvas that feeds
  `renderLook`. No file-format side path; the engine never learns about RAW
  containers. First paint is untouched: the module loads on the first RAW
  file, never up front.
- **Decode progress UX.** FlashRaw reports timings only after a decode; there
  is no progress callback. Show an indeterminate spinner on the file tile.
  The embedded preview (`raw.preview()`, zero-copy JPEG bytes) renders
  instantly while the real decode runs, so the tile shows something useful
  within milliseconds. Cancellation goes through `AbortSignal`.
- **Decoder cache.** GitHub Pages sets short cache lifetimes, so the 1.3 MB
  asset re-downloads per visit. Cache it in Cache Storage on first fetch, and
  fold it into the PWA precache planned for v0.3.0 so offline decode works.
- **Privacy.** The decoder runs in WASM on the device and makes no network
  calls. We self-host the `.wasm` files from `web-dist/` (`init({ baseUrl })`
  or the build copy), so no CDN request happens at runtime either.
- **Pinning.** `flashraw` is one month old with a single maintainer. Pin the
  exact version in `package.json` (no caret) and upgrade deliberately. The
  risk this carries is bus factor 1, which is why a named fallback exists.

## Cut recorded

- **Full-LibRaw WASM as the primary** (`libraw-wasm`, `@wasmedia/wlibraw`):
  the `libraw.wasm` payload is only 484 KB gz, small, but native benchmarks
  put LibRaw 12-22x behind FlashRaw, no in-browser numbers exist, a 24 MP
  decode in single-threaded WASM plausibly approaches the 5 s budget, and both
  packages carry LGPL licensing that is muddier for a bundled static site
  than MIT/Apache. Kept as the named fallback only. Whether the libraw-wasm
  build enables CR3 is unverified.
- **`@wasmedia/wlibraw`**: a second LibRaw port adds nothing over the first,
  LGPL-2.1-only, no benchmark data. Cut.
- **`rawconvert-wasm`**: v0.1.1, no performance evidence, LibRaw-derived with
  unclear inherited licensing. Cut.
- **dcraw ports** (`dcraw-wasm`, `dcraw.js`): dcraw froze in 2018 and has no
  CR3 path at all. Cut outright.
- **ImageMagick WASM**: multi-MB general-purpose suite, RAW support in the
  wasm build unverified. Cut.
- **Vendored minimal DNG/TIFF decoder**: uncompressed and deflate strips are
  easy, but the common modes need a lossless-JPEG decoder, opcode lists
  (WarpRectilinear, FixVignetteRadial), DCP camera profiles, and then CR3's
  ISO-BMFF + CRX and Sony's lossless codecs on top. That is a multi-week
  rewrite of what FlashRaw ships in 1.27 MB gz, for a worse result. Cut;
  DNG-only remains the emergency fallback.
- **WebGPU backend**: FlashRaw ships one as an opt-in binary, but the CPU is
  fast enough for the budget. Deferred, not needed for v0.6.0.

## Unverified

- WASM decode latency for a 24 MP file in a real browser. Native numbers are
  27.8-57.7 ms RAW-to-sRGB at 24-26 MP; the vendor's in-browser figure is
  ~100 ms for 17 MP CR3. Our 24 MP target has margin on paper, but the
  integration ticket must measure it before we claim it.
- CR3 decode inside the `libraw-wasm` fallback build.
- WASM payload gzip sizes for `@wasmedia/wlibraw` and `rawconvert-wasm`
  (package sizes only, binaries unmeasured).
