# User Guide

## Load a roll

- **Folder pick.** Press LOAD and choose a folder. Chrome and Edge on desktop open
  the real folder (via the File System Access API), so results can be saved straight
  into a subfolder of it. Other browsers pick the photos inside a folder instead.
- **Drag and drop.** Drop a folder or a pile of JPGs anywhere on the window.
- Only top-level `.jpg` / `.jpeg` files load; subfolders are ignored. Shots sort by
  name. Tap `○` (or press Space) to pick shots, or develop the whole roll.

## Film stocks

Nine presets sit on the left. Each one sets all thirteen sliders at once:

Clean Scan · Drugstore Disposable · Super 8 Home Movie · Instant Mini · Cine Reel 35 ·
Golden Summer · Expired '89 · Party Flash · Tri-Mono B&W

Touch any slider and the stock reads as *custom*. Double-click a slider label to reset
that control to the stock's value.

## The sliders

| Slider | What it does |
| --- | --- |
| Exposure, Contrast, Saturation | The basics. |
| Warmth, Tint | Colour cast; warm shifts reds up, tint shifts green/magenta. |
| Fade | Lifts blacks, washes the image toward the film's paper base. |
| Split tone | Tints shadows toward the shadow colour and highlights toward the highlight colour. |
| Grain, Grain size | Film grain amount and clump size. |
| Vignette | Corners fall off. |
| Softness | Low-frequency lens/halation blur. |
| Light leak | Edge glows in orange or red. Seeded by file name: the same file always leaks the same way. |
| Flicker | Per-shot exposure wobble, like a winding motor. Also seeded by file name. |

## Output settings

| Setting | Meaning |
| --- | --- |
| Quality | JPEG quality (default 72). The size estimate updates as you move it. |
| Max edge | Long edge of the output in pixels. 0 keeps the original size. |
| Mode | `single` develops one JPG per shot; `strip` composites shots onto 35mm strips, `stripN` shots per strip. |
| Folder name | Subfolder for results (default `developed`). Unsafe characters are stripped. |
| Date format | The orange seven-segment date stamp: `'YY MM DD`, `MM DD 'YY` or `DD MM 'YY`. |

## Saving

- **Chrome / Edge (desktop).** The app saves into a subfolder of the roll folder,
  `developed/` by default, and never touches the originals. Files never overwrite:
  see [The Laws](laws.md).
- **Firefox, Safari, phones.** The results download: one JPG for a single shot, a
  `.zip` for a batch. The batch is held in memory until the zip is built, so very
  large rolls work best in Chrome or Edge.
- A single shot can be saved on its own with SAVE THIS (the current preview).
- DEVELOP runs the whole selection; progress shows per shot with a before → after
  size total.

## Browser support

| Browser | Loading photos | Saving results |
| --- | --- | --- |
| Chrome, Edge (desktop) | Pick or drop a folder | Saves into a `developed/` subfolder of it |
| Firefox, Safari, others | Pick or drop a folder or photos | Downloads: one JPG, or a `.zip` for several |
| Phones | Pick photos | Downloads |
