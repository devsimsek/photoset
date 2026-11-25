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

## Film studio

A look can travel: export it as a film JSON file, import one back. Films follow
[schema v1](internals/film-schema.md) - see that page for every field and range.

- **Export film.** Downloads the current look as `<film-id>.json` and offers
  *COPY JSON* to put the same text on the clipboard.
- **Import film.** Opens a dialog where you paste a film JSON or choose a
  `.json` file. Esc closes the dialog; nothing is applied until the film
  validates.
- **Validation.** Unknown schema versions, missing keys, out-of-range slider
  values, non-hex split-tone colours and unknown aspect, frame or date-format
  values are refused with a message; the current look stays untouched. A valid
  film becomes the active look immediately and joins the library.

## The film library

- **Save film** turns the current look into a film: give it a name and an ISO
  (both display text). It appears in the stocks list with a *CUSTOM* marker and
  is stored in the browser under `darkroom.films`; a reload brings it back.
  Built-in stocks are never modified by the library.
- Clicking a saved film applies its look. The film tools then appear:
  **rename** (the name changes, the film's id and identity stay the same),
  **save over** (writes the current sliders onto that film, same id), and
  **delete** (removes it for good). *Save film* on an active film saves the
  look as a new film instead.
- Importing a film whose id already exists in the library updates that film in
  place; otherwise it joins the library. Developing with a saved film active
  puts the film's name on the strip edge print.

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
| Quality | Encode quality (default 72). Applies to JPG and WebP; PNG ignores it. The size estimate updates as you move it. |
| Format | Output format: JPG (default), WebP or PNG. The file extension follows the format. Loading is JPG-only by design. |
| Size cap | Optional max output size per photo, in KB. Empty means no cap. JPG and WebP search for the largest quality that fits (down to quality 10, which ships even if it misses the cap); PNG is lossless, so it scales the long edge down in 10% steps to 50% instead. The size estimate reflects the cap. |
| Keep EXIF | Writes the capture date back into JPG output as a minimal EXIF block. Off by default: a canvas re-encode strips EXIF, and WebP/PNG always skip it. |
| Max edge | Long edge of the output in pixels. 0 keeps the original size. |
| Mode | `single` develops one file per shot; `strip` composites shots onto 35mm strips, `stripN` shots per strip. |
| Folder name | Subfolder for results (default `developed`). Unsafe characters are stripped. |
| Date format | The orange seven-segment date stamp: `'YY MM DD`, `MM DD 'YY` or `DD MM 'YY`. |

## Saving

- **Chrome / Edge (desktop).** The app saves into a subfolder of the roll folder,
  `developed/` by default, and never touches the originals. Files never overwrite:
  see [The Laws](laws.md).
- **Firefox, Safari, phones.** The results download: one file for a single shot, a
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

## Offline and the service worker

After your first visit, the app's shell (page, scripts, styles, icon) is
precached by a service worker. Reload the page with the network gone and the
darkroom still boots from the cache, right down to the last film stock.

- Navigations are network-first: when a new version deploys, a reload picks it
  up. If the network is unavailable, the cached shell page answers instead.
- Shell assets are cache-first with cache-and-update: offline visits serve the
  stored copy, online visits refresh it in the background for next time.
- Only GET requests ever touch the cache; everything else passes straight
  through.
- Your photos and develops never go through the service worker at all: loading
  and saving happen entirely in the page.
