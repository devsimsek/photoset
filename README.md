# Photoset Darkroom

Retro film looks, film strips and batch JPG compression for a whole folder of photos.
It comes in two versions built from the same code in `src/renderer/`:

- **Desktop app** (Windows, Electron): `npm install`, then `npm start`, or `npm run dist` to build the installer in `dist/`.
- **Web app** (GitHub Pages): a static site. Everything runs in the browser; photos are never uploaded.

## Self-hosting the web app on GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml), which builds the site and publishes it.
   You can also run it by hand from the **Actions** tab ("Deploy web app to GitHub Pages" → Run workflow).
4. The site address appears in the workflow run and under Settings → Pages, usually `https://<user>.github.io/<repo>/`.

The build needs no `npm install`; it only runs `build/make-icon.js` and `build/build-web.js`.

### Preview locally

```
npm run serve:web
```

Then open http://localhost:5178.

## Browser support

| Browser | Loading photos | Saving results |
| --- | --- | --- |
| Chrome, Edge (desktop) | Pick or drop a folder | Saved straight into a subfolder of it (`developed/`) |
| Firefox, Safari, others | Pick or drop a folder or photos | Downloaded: one JPG, or a `.zip` for several |
| Phones | Pick photos | Downloaded |

Saving never overwrites existing files: strips continue numbering (`strip_002.jpg` …) and repeated photos get `name (2).jpg`.
In the download mode the whole batch is held in memory until the zip is built, so very large rolls work best in Chrome or Edge.
