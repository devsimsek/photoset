# The Laws

These are product guarantees, not implementation details. Tests pin them, and no
change that weakens them ships.

## Never overwrite

A save never replaces an existing file, whatever the extension: `.jpg`, `.webp`
and `.png` results all follow the same rule.

- **Strips continue numbering.** When the target folder already holds
  `strip_001.jpg` (and on through the taken numbers), a new strip takes the next
  free number with the same zero padding: `strip_004.jpg`. Padding width is
  preserved, so a two-digit run (`strip_01.jpg`) stays two digits (`strip_02.jpg`).
  The same holds for `strip_001.webp` and `strip_001.png`.
- **Everything else gets a copy number.** When `beach.jpg` exists, the next save
  becomes `beach (2).jpg`, then `beach (3).jpg`; `beach.webp` becomes
  `beach (2).webp`.

The full algorithm, with both the batch-level and on-disk checks, is documented in
[internals/naming](internals/naming.md).

## RAW decodes on the device

RAW files (DNG, CR3, ARW) develop through a WebAssembly decoder that ships with
the app, never through a remote service.

- **No pixels, no files, no round trip.** Decoding happens on the device. A RAW
  file is never uploaded, no decode API is called, and the decoder itself makes
  no network calls. The decoder's wasm and glue files are self-hosted from the
  app's own deployment; no CDN is contacted at runtime.
- **First paint never pays.** The decoder is a lazy asset outside the 150 KB
  app ratchet (ADR 0004): it downloads only when a RAW file is first decoded,
  and the service worker caches it on first fetch so later decodes work
  offline. It is never precached at install time.
- **Same pipeline, no side path.** A RAW shot decodes to RGBA pixels and
  develops through the engine exactly like a JPG; no file-format branch exists
  in the develop path. RAW tiles may show the camera's embedded preview while
  the real decode runs, but a develop output is always the decoded sensor
  image.
- **Decode on demand, then drop.** The app never decodes a whole roll of RAW
  files up front. One full decode lives in memory per view; develops decode
  each shot, render it and release it. Changing rolls aborts every in-flight
  decode.

## Rolls persist as metadata, never as pixels

The darkroom may remember what a roll was: shot file names, sizes, modification
times, capture dates it already read, picks, and the highest strip number it has
produced. It may never store image bytes, data URLs, or any other encoding of
pixel data.

- **A remembered roll shows names without pixels.** After a reload, the contact
  sheet lists the remembered shots as placeholders until the folder is re-picked;
  the app never pretends pixels came back on their own.
- **Re-picking the folder relinks the roll.** Matching happens by exact file name;
  when at least half the remembered shots are present, picks restore and strip
  numbering continues past the remembered high-water mark.
- **Missing shots stay visible.** Remembered names absent from the re-picked
  folder are flagged in the photo list, never silently dropped, and the batch
  develop skips them. A fresh load of a different folder replaces the remembered
  roll instead of merging.

## GPS coordinates never ship by default

A developed file carries the shot's location only when the photographer turns
the GPS toggle on. The toggle sits next to Keep EXIF, is labeled plainly, and
stays off in every fresh session. Coordinates are written to JPG output only
when Keep EXIF and the GPS toggle are both on and the source file carries
coordinates. The app never invents, looks up or estimates a location.

## Originals are never touched

The app reads your photos and writes results into a separate subfolder
(`developed/` by default). It never modifies, moves or deletes a source file.
In browsers without the File System Access API, results download instead, so the
originals sit exactly where you left them.

## The date stamp reads the capture date

The orange seven-segment stamp prefers the EXIF capture date (`DateTimeOriginal`).
If the file carries no usable EXIF, it falls back to the file's modification time.
No capture date is invented; a file with neither falls back to the mtime, which is
the best information available on disk.
