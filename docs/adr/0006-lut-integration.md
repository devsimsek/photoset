# ADR 0006: .cube LUT integration

Date: 2026-11-27 · Status: Proposed (PS-44; ratified when PS-45/46 land)

## Context

The v1.3 wave adds .cube LUTs: import a 3D LUT as a film (PS-45), export a v1
film's grade baked into a .cube (PS-46). The owner fixed one constraint up
front: the wave ships with zero dependencies. The parser is our code. The
bundle ratchet (150 KB JS+CSS, never raised) still governs it; a cube parser
costs a few KB of readable JS, not a library.

Three house laws shape the design:

- Privacy: files parse on the device, no upload, no decode API.
- Reproducibility: the same file + film produces byte-identical output. A LUT
  is deterministic pure math over a stored table, so the law survives intact.
- The engine is 2D canvas ImageData, pixel by pixel, no WebGL, no workers
  (docs/internals/engine.md). The colour step today is a 256-entry per-channel
  curve, then per-pixel saturation and split-tone in one loop.

A .cube file is plain text. Getting the table format wrong produces a "valid"
file that sends every colour to the wrong place, so the ordering and the
header rules below are cited, not assumed.

## .cube format facts

Origin: the IRIDAS Cube LUT format (`doc.iridas.com/index.php/LUT_Formats`),
later formalized by Adobe as *Cube LUT Specification 1.0*. OpenColorIO's
reference parser quotes the IRIDAS document verbatim and implements it as
`iridas_cube`; Adobe's spec adds the DOMAIN keywords and a fixed grammar.

- Header: optional `TITLE "text"`; exactly one of `LUT_3D_SIZE N` (a 3D
  table, N³ rows) or `LUT_1D_SIZE N` (a 1D table, N rows). A file may hold a
  1D or a 3D table, never both.
- Optional `DOMAIN_MIN r g b` / `DOMAIN_MAX r g b`: the input value that maps
  to the first / last grid point. Defaults `0 0 0` / `1 1 1`. Inputs outside
  the domain clip to it.
- IRIDAS/Resolve-style files may instead carry `LUT_1D_INPUT_RANGE lo hi` /
  `LUT_3D_INPUT_RANGE lo hi`.
- Table: one `r g b` float triple per line for every lattice point, in
  ascending index order. Ordering, quoted from the Adobe spec (section 7.2):
  "The lines of table data shall be in ascending index order, with the first
  component index (Red) changing most rapidly, and the last component index
  (Blue) changing least rapidly." OpenColorIO mirrors this with
  `setArrayFromRedFastestOrder`, and the IRIDAS doc's 2x2x2 example shows red
  flipping every line, green every two, blue every four.
- Table values are floats not limited to any range (under 0.0 and over 1.0
  are legal); the host may clip outputs to 0..1.
- `#` comments and blank lines are allowed anywhere.

Sizes (rows are N³; text sizes measured for 6-decimal floats at 27 bytes a
row; table memory is the Float32Array a parsed file holds; parse time measured
in Node 26.7.0 single-threaded on this machine):

| Size | Rows | .cube text | Float32 table | Parse |
| --- | --- | --- | --- | --- |
| 17 | 4,913 | 130 KB | 58 KB | ~1 ms |
| 25 | 15,625 | 400 KB | 183 KB | ~4 ms |
| 33 | 35,937 | 948 KB | 421 KB | ~9 ms |
| 65 | 274,625 | 7,241 KB | 3,218 KB | ~70 ms |

Parse cost is a non-issue at every size. The real costs are file payload and
film JSON size, which cap sharing (see Consequences).

## Candidates

### Interpolation: trilinear vs tetrahedral vs prismatic

Measured on this machine (Node 26.7.0, M-series MacBook, single thread,
medians of 7 runs after warm-up; 4000x3000 = 12 MP Uint8ClampedArray, 33-cube
Float32 table, red-fastest order):

| Kernel | 12 MP cost |
| --- | --- |
| Current grade loop (curve + saturation + split-tone) | 69 ms |
| Trilinear (8 corners, 7 lerps x 3 channels) | 223 ms |
| Tetrahedral (4 corners, 6-case branch split) | 239 ms |

A sanity check cross-validated the kernels: on an affine test transform both
agree to under 0.00005 across 4,096 sampled colours. Both are exact for
multilinear transforms, so agreement there confirms both are implemented
right; differences appear only inside cells for curved tables.

Reading: tetrahedral costs about the same as trilinear in modern JS. The
branch split is not cheaper than 8 direct fetches. The engine can afford
either: +220 ms at 12 MP sits on top of a ~700 ms RAW decode (ADR 0004
measured) and a 70 ms grade, and preview edges are far below 12 MP.

Tetrahedral's accuracy edge matters for sharp, low-resolution tables and for
Log-domain conversion LUTs. The tables this app applies are creative looks
and our own smooth baked grades on 8-bit output; the difference sits below
the output quantisation step. Prismatic is cheaper again but visibly less
accurate; not a contender.

### Schema v2 LUT storage: embedded table vs file reference

| Option | Film JSON size (33-cube) | What breaks |
| --- | --- | --- |
| Float table in JSON | ~737 KB | Paste and QR dead; paste of 737 KB text is unusable |
| Base64 of 8-bit table | ~140 KB | Re-export fidelity: up to 1/255 per entry |
| File reference (lut.cube beside the film) | ~0 | Film stops being one JSON object; breaks the film contract, the library persistence, and re-picking relink logic |

The film contract says a film is one JSON object that travels as a file or
pasted text. A reference tears that apart for no payload win worth it.

## Decision

**Primary: trilinear interpolation over an embedded 8-bit table, schema v2,
sizes 17 to 65 accepted.**
**Fallback: float table in the film JSON if 8-bit quantisation ever shows in
re-export comparisons.** It raises the 33-cube film to ~737 KB and keeps every
other rule unchanged.

Concretely:

- **Pipeline position.** The LUT applies immediately after the existing
  colour-grade step and before the light leak: colour operations stay ahead
  of the optical stack (leak, vignette, grain), the date stamp stays after
  the grade, and the seeded-RNG reproducibility law is untouched. A film with
  both sliders and a LUT runs grade first, LUT second; an imported .cube
  film arrives with all-zero sliders plus its table. Implementation is a
  separate `getImageData`/`putImageData` pass, fused into the grade loop only
  if profiling ever says so.
- **Schema v2.** `schema: 2` accepts everything v1 does (19 look keys,
  optional `rotate`, v1 imports forever) plus an optional root-level `lut`
  object: `{ name, size, table }`. It sits at the root because the house law
  grows films at the root (unknown root keys are ignored, unknown look keys
  refuse), and the look contract stays byte-for-byte as documented. `size`
  accepts 17 to 65 inclusive; `table` is base64 of `size³ x 3` bytes, each
  byte the 8-bit output value at that lattice point in red-fastest order;
  `name` carries the cube's TITLE for re-export. Refusal messages spell out
  the accepted range and the exact expected length.
- **Import (PS-45).** 3D tables only; a `LUT_1D_SIZE` file refuses with a
  message. Sizes outside 17..65 refuse. Row count must equal N³ exactly;
  non-finite values refuse. `DOMAIN_MIN`/`MAX` (and INPUT_RANGE) must equal
  the 0/1 default or the file refuses: the engine feeds it 8-bit Rec.709-ish
  sRGB frames, and a Log-input conversion LUT would clip to garbage. Table
  values outside [0,1] clamp on apply, which the 8-bit write does anyway.
  TITLE, when present, names the film on import.
- **Export (PS-46).** Baking a v1 film means evaluating the full grade
  function G(r,g,b) at every lattice point. G is exactly the engine's order:
  per-channel curve (exposure, contrast, fade, warmth/tint gains) by linear
  interpolation between the 256 table entries at the fractional lattice
  input, then saturation toward the luma of the curved values, then
  split-tone offsets weighted by `(1-t)²` / `t²` with `t = luma/255`. The
  engine's write-clamp keeps every baked entry inside [0,1], so the exported
  cube stays in range for hosts that clip. The cube is written with 6-decimal
  floats (OCIO bakes at the same precision), explicit DOMAIN lines, and red
  fastest. A film carrying a LUT exports grade-then-LUT, same pipeline order.
- **Honesty about export fidelity.** A baked cube cannot be byte-identical to
  the engine's grade between lattice points; trilinear over a 33-cube
  approximates the curve in between. At the lattice points it matches by
  construction, and in between the error stays near the 8-bit quantisation
  step for these smooth grades. Tests pin engine-vs-cube output within a
  stated tolerance, not byte equality; byte equality stays reserved for the
  same-file-same-film law, where the LUT is deterministic and exact.
- **Sharing cap.** A v1 film is a few hundred bytes. A v2 film with a LUT is
  ~19 KB (17-cube) to ~140 KB (33-cube) as base64. QR max capacity is ~2.9 KB
  and pasting 140 KB of text is not a flow anyone wants. LUT films therefore
  share as downloaded files only: the QR and paste buttons refuse with a
  message when the film carries a `lut`. The cap is a law, not a size check.

## Cut recorded

- **Tetrahedral interpolation.** Measured within 7 percent of trilinear on
  the 12 MP path, accuracy gain below the 8-bit output step for smooth
  tables, and the 6-case branch split is more code to test on a path where
  byte-reproducibility scenarios already pin behaviour. Trilinear everywhere.
- **WebGL / WebGPU LUT pass.** A GPU pass means a rewrite of the colour step:
  texture upload per develop, and GPU float precision varies across devices
  and drivers, which breaks the byte-identical reproducibility scenarios
  unless a CPU fallback ships too. The measured CPU cost makes that trade
  wrong today. Revisit only if batch develops on large outputs feel slow;
  the honest next step then is fusing the loops or moving to a worker, not
  WebGL. SVG/CSS filter paths do 1D curves only and never were a candidate.
- **Sizes under 17.** Banding on smooth grades; creative looks in the wild
  start at 17. Refused with a message.
- **Sizes over 65.** 7.2 MB of text and 1.07 MB of film JSON for accuracy the
  8-bit output cannot show. Refused with a message.
- **1D cube files.** Refused for v1.3. The house curves are already 256-entry
  per-channel tables internally; a 1D import path can map onto them later if
  anyone asks.
- **Non-default input domains (Log-space conversion LUTs).** Refused. The app
  has no Log stage to feed them; accepting them would produce clipped garbage
  that looks like a bug in our engine.

## Verified

- Ordering, header keywords, defaults, and the 1D/3D exclusivity rule against
  OpenColorIO's `FileFormatIridasCube.cpp` (which quotes the IRIDAS spec
  verbatim, including the red-fastest example) and against the Adobe Cube LUT
  Specification 1.0's indexed text (section 7.2 ordering sentence, TITLE and
  DOMAIN grammar, N up to 256).
- Perf numbers above, measured in Node 26.7.0 on this machine, medians of 7
  runs after warm-up; kernels cross-validated to agree on an affine
  transform.
- Payload arithmetic: 27 bytes per 6-decimal row measured on a generated
  33-cube (1,006,235 bytes for 35,937 rows).

## Unverified

- The Adobe spec PDF itself would not open on this machine: both mirrors
  carry an RC4-encrypted copy and empty-password decryption failed, so exact
  section numbers beyond 7.2 (a Blackmagic forum post puts DOMAIN_MIN/MAX in
  5.6) come from secondary sources.
- Trilinear cost in WebKit/Safari: measured under V8. JSC should land in the
  same order of magnitude, but no measurement exists.
- Whether every Lightroom-class host honours table values outside [0,1]: our
  bake never emits them, so the question is moot for files we produce, but a
  hand-made cube with out-of-range entries may behave differently elsewhere.
- The ~2.9 KB QR capacity figure is the standard version-40 limit from memory,
  not re-checked.
