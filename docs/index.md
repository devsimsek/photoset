# Photoset Darkroom

Photoset Darkroom develops a whole folder of photos in one pass: retro film looks,
film strips you can print, and batch JPG compression that shrinks big rolls.

Everything runs in your browser. **Photos never leave the device.** There is no
server, no upload, no account. The page reads your files, renders them on a canvas
and writes the results back to disk (or downloads them) locally.

## Quick start

```sh
npm run serve:web
```

Then open [http://localhost:5178](http://localhost:5178). No `npm install` is
needed for the web build itself; the build scripts are plain Node with zero
dependencies.

## What it does

- **Film stocks.** Nine preset looks: Clean Scan, Drugstore Disposable, Super 8
  Home Movie, Instant Mini, Cine Reel 35, Golden Summer, Expired '89, Party
  Flash, Tri-Mono B&W. Every stock stays adjustable with thirteen sliders.
- **Film strips.** Batch mode composites shots onto a 35mm-style strip with
  sprocket holes and edge print, ready to print.
- **Batch compression.** Quality and max-edge settings compress a whole roll in
  one run, with a before/after size estimate per shot and for the roll.
- **The never-overwrite law.** Saving never replaces an existing file. See
  [The Laws](laws.md).

## Read next

- [User Guide](user-guide.md): loading a roll, stocks, sliders, output, saving.
- [Self-Hosting](self-hosting.md): run the app from your own GitHub Pages site.
- [The Laws](laws.md): naming, overwrite and date-stamp guarantees.

The live Pages site, once deployed, lives at
[devsimsek.github.io/photoset](https://devsimsek.github.io/photoset/), with this
documentation under `/docs/`.
