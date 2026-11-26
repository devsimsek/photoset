# User Guide

## Load a roll

- **Folder pick.** Press LOAD and choose a folder. Chrome and Edge on desktop open
  the real folder (via the File System Access API), so results can be saved straight
  into a subfolder of it. Other browsers pick the photos inside a folder instead.
- **Drag and drop.** Drop a folder or a pile of JPGs anywhere on the window.
- Only top-level `.jpg` / `.jpeg` / `.dng` / `.cr3` / `.arw` files load; subfolders
  are ignored. Shots sort by name. Tap `○` (or press Space) to pick shots, or
  develop the whole roll.

## RAW shots

RAW files develop through the same pipeline as JPGs, on your device:

- **Formats.** DNG (including phone ProRAW-style linear DNGs), Canon CR3 and
  Sony ARW. The decoder is FlashRaw, a WebAssembly library that ships with the
  app itself: no CDN, no server round trip, no decode service. Pixels never
  leave the machine.
- **Preview first.** A RAW tile shows the shot immediately: the camera's
  embedded preview renders within milliseconds of the roll loading, with a
  small spinner while the real decode runs in the background. Files without an
  embedded preview just wait for the decode. Once you view or develop the
  shot, the full decode replaces the preview on the tile.
- **Decode on demand.** The full RAW decode happens when you look at a shot or
  develop it - never for the whole roll up front. The decoded pixels are
  dropped again when you move on: one decoded shot sits in memory at a time,
  and a develop decodes each shot, renders it and drops it.
- **The decoder is a lazy asset.** The app shell loads as before; the decoder
  (about 1.3 MB gzipped) downloads only the first time a RAW file is decoded,
  is cached by the app's service worker from then on, and works offline after
  that. Opening the app without RAW files never downloads it.
- **EXIF.** A RAW file has no JPEG EXIF to carry over. The *Keep EXIF* toggle
  writes the capture date from the RAW metadata when the file carries one, and
  writes nothing when it does not.
- **Latency.** A 24 MP DNG decodes in well under a second in a desktop
  browser (measured around 0.7 s in Chromium on an M-series MacBook); the
  budget is five seconds, and the suite pins it.

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
- **Share as a link.** The film dialog offers *COPY LINK*: the app's own
  address with the film JSON riding in the hash. Opening that link anywhere
  Photoset runs imports the film on boot and applies the exact look, and an
  invalid payload refuses by name. The hash is cleared after the import, so
  reloading the page does not re-import the film.
- **QR code.** The dialog draws a QR of the same link next to *COPY LINK*,
  when the payload fits one code (a schema v1 film does, with room to spare;
  the encoder is byte mode at error correction L, no dependencies). Long-press
  or right-click the QR to save it as an image. A payload too big for a single
  QR offers the link alone.

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
| Grain, Grain size | Film grain amount and clump size. Like the leak and the flicker, the grain is seeded by file name: the same file with the same film develops identically every time, and two shots that differ only by name still grain differently. |
| Vignette | Corners fall off. |
| Softness | Low-frequency lens/halation blur. |
| Light leak | Edge glows in orange or red. Seeded by file name: the same file always leaks the same way. |
| Flicker | Per-shot exposure wobble, like a winding motor. Also seeded by file name. |

## Rotate a shot

The FORMAT section offers a rotation: 0, 90, 180 or 270 degrees. The turn
applies before the crop, so the crop rect computes on the rotated frame: a
landscape shot turned a quarter develops as a portrait, and a 3:2 crop then
frames the rotated shot 2:3. The rotation is part of the look: it persists
with your settings, rides in an exported film JSON as an optional `rotate`
key (absent means 0), and films written before the key existed import
unchanged.

## Output settings

| Setting | Meaning |
| --- | --- |
| Quality | Encode quality (default 72). Applies to JPG and WebP; PNG ignores it. The size estimate updates as you move it. |
| Format | Output format: JPG (default), WebP or PNG. The file extension follows the format. Loading is JPG and RAW (DNG/CR3/ARW) by design. |
| Size cap | Optional max output size per photo, in KB. Empty means no cap. JPG and WebP search for the largest quality that fits (down to quality 10, which ships even if it misses the cap); PNG is lossless, so it scales the long edge down in 10% steps to 50% instead. The size estimate reflects the cap. |
| Keep EXIF | Writes the shot's EXIF story back into JPG output: the capture date, plus camera, model, lens, ISO, exposure time and aperture when the source JPG carries them. Off by default: a canvas re-encode strips EXIF, and WebP/PNG always skip it. |
| GPS coordinates | A separate toggle next to Keep EXIF, off by default. When Keep EXIF is on and the source carries coordinates, this adds the shot's latitude and longitude to the JPG. Coordinates never ship without it. |
| Max edge | Long edge of the output in pixels. 0 keeps the original size. |
| Mode | `single` develops one file per shot; `strip` composites shots onto 35mm strips, `stripN` shots per strip. |
| Folder name | Subfolder for results (default `developed`). Unsafe characters are stripped. |
| Date format | The orange seven-segment date stamp: `'YY MM DD`, `MM DD 'YY` or `DD MM 'YY`. |

## The shot's story travels

A develop re-encodes through a canvas, which strips EXIF. With *Keep EXIF* on,
the developed JPG gets its story back: the capture date the date stamp reads,
plus camera make and model, lens make and model, ISO, exposure time and
aperture when the source JPG carries them. Fields the source lacks are left
out, never faked. GPS coordinates are a separate, plainly labeled toggle next
to Keep EXIF, off by default: they are written only when both toggles are on
and the source carries coordinates, and the app never invents or estimates a
location (see [The Laws](laws.md)).

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
- **A failed shot never stops the batch.** If a shot cannot be developed, the run
  finishes the rest and the end-of-batch toast lists every failure by name with a
  reason, for example: *developed 9, failed 1: vacation_04.jpg (could not be
  decoded)*. Shots flagged MISSING from the folder are skipped by the batch and
  are not reported as failures.

## Your rolls, remembered

When you load a roll, the darkroom remembers what it was: the roll name, the shot
file names, their sizes and modification times, capture dates it has already read,
your picks and how far strip numbering got. This memory lives in your browser's
local storage, stays within a few kilobytes for a whole roll, and holds not a
single pixel: photos are image data, and image data is never written to storage.

Reload the page (or come back tomorrow) and the roll is still there, remembered.
The contact sheet lists the shots greyed out, with a note that the pixels are
gone and a RE-PICK THE FOLDER button. Nothing is faked: the remembered shots have
no thumbnails and cannot be developed until the folder is back.

Re-pick the same folder and the roll restores: matching happens by exact file
name, and it takes effect when at least half the remembered shots are present in
the folder, so a partially re-copied folder still relinks the shots that are
there. Your picks come back and strip numbering continues where the roll left
off: a roll whose last strip was strip_004 starts the next batch at strip_005.

Shots the folder no longer contains are not dropped: they stay in the contact
sheet with an orange MISSING badge, marked "missing from folder", and a batch
develop skips them. Loading a completely different folder replaces the
remembered roll instead of merging the two; nothing flagged survives that
replacement.

## On your phone

The darkroom is laid out for a phone first: at a narrow window the three
panels stack in a single column (preview, contact sheet, controls), and the
core loop - load a roll, pick shots, develop, save - all works at a 375 px
wide screen with no sideways scrolling.

- Every control you touch gives a thumb a fair target: buttons, the develop
  and save controls, the slider rows, the pick circles and the form fields
  each offer at least 44 by 44 points. The drawn design stays as it is on a
  desktop; only the hit areas grow.
- Loading works by tapping LOAD ROLL or CHOOSE FOLDER; phones pick photos
  instead of folders (the browser decides).
- **Huge rolls stay usable.** A folder holding a whole phone's photos opens
  without choking: the contact sheet renders its tiles lazily as you scroll,
  the shots' metadata is read in batches of 64 so the page never stalls on
  thousands of files at once, and a progress line at the bottom of the sheet
  shows the count while the roll is read and prepared. The line goes away when
  the roll is ready. A shot that cannot be read is never swallowed: a toast
  names it, it stays listed with its size, and the rest of the roll loads and
  develops normally.
- **Paste a photo.** Copy an image anywhere on the device and paste it into
  the darkroom: it joins the current roll (or starts a new roll called
  *pasted*). The roll loads JPG photos, so a pasted PNG is re-encoded to JPG
  through the canvas at paste time, and any other format is refused with a
  toast naming the format.

## Share photos into Photoset

Install Photoset and it shows up in your system's share sheet: share a photo
from any app (gallery, files, camera) and choose Photoset Darkroom. The shared
shot joins the current roll - or starts one - and runs the same intake as a
paste, so a shared PNG is re-encoded to JPG and anything else is refused with
a toast naming the format. A share that carries no usable photos is answered
with a toast that says so, never silence. The shared file travels through the
app's own service worker on your device; it never leaves it.

## Keyboard

| Key | What it does |
| --- | --- |
| ← → or ↑ ↓ | Move the selection to the previous / next shot in the roll. |
| j / k | Next / previous shot, the same as the arrows. |
| Space | Pick or unpick the selected shot. |
| Enter | Develop the selected shot on its own. |
| Escape | Close the film studio dialog. |

Typing in a text field (film name, the film JSON paste area, the size cap or
the folder name) never moves the selection.

## Browser support

| Browser | Loading photos | Saving results |
| --- | --- | --- |
| Chrome, Edge (desktop) | Pick or drop a folder | Saves into a `developed/` subfolder of it |
| Firefox, Safari, others | Pick or drop a folder or photos | Downloads: one JPG, or a `.zip` for several |
| Phones | Pick photos | Downloads |

## Install and offline

Install on the desktop (Chrome/Edge): the install icon in the address bar, or
the browser menu's "Install Photoset Darkroom". On Android the browser offers
"Add to Home screen"; on iOS use Share, then "Add to Home Screen". The
installed app runs standalone, without browser chrome, and uses the dark
theme colour for its window and splash. The manifest declares both a regular
512 icon and a maskable variant (the camera art sits inside the safe zone, so
Android's circle crop keeps it whole), and the home-screen icon is the same
camera mark via the apple-touch-icon link.

### Offline behaviour

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

## Updates: the "New version ready" toast

When a newer version of the app has been deployed and downloaded in the
background, a toast appears: **New version ready** with a RELOAD button.
Nothing happens until you click it: the page never reloads on its own, and
ignoring the toast is fine. Clicking RELOAD swaps in the new version and
reloads the page. The toast respects your reduced-motion setting and is fully
keyboard reachable.
