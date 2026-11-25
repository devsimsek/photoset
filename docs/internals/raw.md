# RAW internals

How RAW support works, what the fixture is, and where the latency numbers come
from. The product laws live in [the laws](../laws.md), the decision in
[ADR 0004](../adr/0004-raw-decoding.md).

## Decoder

- `flashraw` 0.5.0, pinned exact in `package.json` (the app's first runtime
  dependency). Fallback per ADR 0004: `libraw-wasm`.
- `build/build-web.js` copies the decoder's JS glue and `.wasm` binaries from
  the installed package into `web-dist/flashraw/`, checked against a list that
  fails the build when the package layout changes. Nothing is fetched from a
  CDN at runtime: `decodeRaw` passes `init: { baseUrl: <app>/flashraw/ }`.
- `web-api.js` `decodeRaw` dynamic-imports `flashraw/worker.browser.js` on the
  first RAW decode only, creates a worker pool of 2, decodes with
  `output: 'rgba8'`, and `putImageData`s the frame into a canvas. App code and
  the engine never learn what a RAW container is.
- `sw.js` serves `/flashraw/*` cache-first into a `photoset-decoder-<version>`
  cache, filled on first fetch, never precached at install. One decode puts the
  whole decoder (page import, worker script, glue imports inside the workers,
  the wasm) into that cache; the next decode works offline.

## Payload

- App ratchet (JS+CSS+HTML incl. sw.js): ~118 KB of the 150 KB ceiling.
- Decoder on disk in `web-dist/flashraw/`: 12 files, 12.9 MB total - glue JS
  139 KB, `flashraw_simd.wasm` 4.16 MB (1.30 MB gz), `flashraw.wasm` fallback
  3.79 MB (1.26 MB gz), `flashraw_simd_jxl.wasm` 6.20 MB (1.80 MB gz, loads
  only for JPEG XL DNGs per ADR 0004).

## Latency, measured (PS-28)

Playwright Chromium on an M-series MacBook, pool worker (single-threaded WASM,
no cross-origin isolation), `decodeRaw` through the app bridge:

| File | Size | Warm decode |
| --- | --- | --- |
| Committed fixture, 1920x1080 CinemaDNG | 1.2 MB | 67-71 ms |
| Ricoh GR III DNG, 6000x4000 (24 MP), lossless JPEG | 33.4 MB | 655-674 ms (738 ms first) |

The 24 MP file is not committed: it was downloaded to `.tmp/` from the CC0
revelraw/raw.pixls.us release for measurement only. The suite pins the
committed fixture under a soft 5000 ms budget.

## Test fixture

`features/fixtures/blackmagic-micro-cinema-camera.dng`: a CC0 CinemaDNG frame
from raw.pixls.us (entry 7317, sha256 of the original
`4c65b8cda205087cfb94d8931811e53e15eb4df538ad67c1b4a3e76c1185b277`) with a
preview SubIFD appended so the embedded-preview path is testable. Sensor data
is untouched and decodes byte-identical to the original; the derivation and
both checksums are recorded in `features/fixtures/README.md`. The build copies
`.dng` files from `features/fixtures/` into `web-dist/fixtures/` for the suite.

## Unverified

- CR3 and ARW paths: no fixture is committed (clean licensing for a
  redistributable CR3/ARW sample under 2 MB did not turn up; the CC0 CR3/ARW
  samples available are 20-30 MB). The code path is format-agnostic - FlashRaw
  reports CR3 CRX and ARW support and the app never branches on format - but
  no browser scenario exercises those containers. The RAW scenarios in
  `features/raw.feature` cover DNG only.
