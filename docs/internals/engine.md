# The Engine

`src/renderer/engine.js` renders everything on canvas. No WebGL, no workers.

## Pipeline order

```
crop → soften → colour grade → light leak → vignette → date stamp → grain → frame
```

1. **Crop.** `cropRect` centers the frame to the aspect: `orig`, 3:2, 4:3, 5:4,
   1:1, 16:9, `cine` (2.39, always landscape) or `instant`. The output is scaled
   so its long edge hits the requested `edge` (preview edge, output max edge, or
   unlimited).
2. **Soften.** A low-frequency blur drawn slightly oversized and clipped, for the
   lens/halation feel.
3. **Colour grade.** A 256-entry LUT per channel builds exposure (f-stop style,
   `2^(exposure/100)`), contrast, fade, warmth/tint gains; saturation and split
   tone apply per pixel. Flicker modulates exposure per shot here.
4. **Light leak.** One or two radial gradient blobs screen-blended in from a
   random edge, orange or red.
5. **Vignette.** A radial gradient that darkens toward the corners.
6. **Date stamp.** Drawn after grading so the grade does not eat it.
7. **Grain.** Monochrome noise composited with `overlay`; grain size scales with
   image size so it stays clumpy at high resolution.
8. **Frame.** The composite wraps the developed frame (see below).

## The seven-segment date stamp

The stamp draws digits as line segments (`SEG` map, segments a-g) instead of
using a font, then skews them slightly and strokes them three times: a wide
orange glow, a second pass to build it up, then a thin bright core. It sits in
the bottom-right corner. Formats:

- `'YY MM DD` (default)
- `MM DD 'YY`
- `DD MM 'YY`

The date comes from EXIF `DateTimeOriginal` (parsed by `exifDate` from the JPEG
header, no library), falling back to the file's modification time.

## The three frame composites

- **35mm strip** (`composeStrip`): a dark band top and bottom with sprocket
  holes, the frames in a row, frame numbers and `▸nA` edge print between them,
  and alternating film name / `SAFETY FILM` edge markings (built-in stocks and
  unlabeled calls print `PHOTOSET 400`; a custom film passes its name in).
  In strip mode
  several shots compose into one image; per-shot framing wraps a single shot.
- **Super 8** (`frameSuper8`): a rounded gate with a dark border, neighbouring
  frames peeking in above and below, a perforation on the left and vertical
  `S8 · 50D` edge marking.
- **Instant** (`frameInstant`): a white card with a thin top/side border and the
  classic thick bottom band, subtle paper gradient and grain.

## Seeded RNG

The random choices (leak position, colour, count; flicker amount; grain) come from a
seeded generator keyed by the file name: `hash` is FNV-1a over the name, `seeded`
is a mulberry32-style PRNG. The same file name produces the same leak, flicker, and
grain on every develop, so re-developing a roll gives stable results and tests
can pin exact output byte for byte, every slider included. Halation sits after
the grade/LUT and before the light leak (PS-52); the paper grain of the instant
frame is seeded with a constant, so even instant prints reproduce.
