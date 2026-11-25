# The Laws

These are product guarantees, not implementation details. Tests pin them, and no
change that weakens them ships.

## Never overwrite

A save never replaces an existing file.

- **Strips continue numbering.** When the target folder already holds
  `strip_001.jpg` (and on through the taken numbers), a new strip takes the next
  free number with the same zero padding: `strip_004.jpg`. Padding width is
  preserved, so a two-digit run (`strip_01.jpg`) stays two digits (`strip_02.jpg`).
- **Everything else gets a copy number.** When `beach.jpg` exists, the next save
  becomes `beach (2).jpg`, then `beach (3).jpg`.

The full algorithm, with both the batch-level and on-disk checks, is documented in
[internals/naming](internals/naming.md).

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
