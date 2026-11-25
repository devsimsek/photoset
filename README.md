# Photoset Darkroom

Retro film looks, film strips, and batch JPG compression for a whole folder of photos, in the browser. Photos are never uploaded.

License: [MIT](LICENSE).

This project was built as an AI experiment. The code was written with Claude (Opus 5.5) and GLM (5.3 Flash).

## Getting started

```
npm run serve:web
```

This builds the site and serves it at http://localhost:5178. Set `PORT` to use another port.

`npm run build:web` builds the static site into `web-dist/`, and `npm run icon` regenerates the app icon. Both are plain Node scripts with no dependencies, so they run without `npm install`. You only need `npm install` to run the test suite.

## Testing

The Gherkin suite runs with `npm run test:bdd`. It needs Playwright's browser once:

```
npx playwright install chromium
```

## Browser support

| Browser | Loading photos | Saving results |
| --- | --- | --- |
| Chrome, Edge (desktop) | Pick or drop a folder | Saved straight into a subfolder of it (`developed/`) |
| Firefox, Safari, others | Pick or drop a folder or photos | Downloaded: one JPG, or a `.zip` for several |
| Phones | Pick photos | Downloaded |

Saving never overwrites existing files: strips continue numbering (`strip_002.jpg` and so on) and repeated photos get `name (2).jpg`. In download mode the whole batch is held in memory until the zip is built, so very large rolls work best in Chrome or Edge.

## Self-hosting on GitHub Pages

Push the project to your repository's `main` branch, then go to Settings, Pages, and set Source to GitHub Actions. The deploy workflow builds and publishes the site on each push to `main`, and you can also run it by hand from the Actions tab. See [docs/self-hosting.md](docs/self-hosting.md) for the full walkthrough (the `docs/` folder is served at `/docs/` once the site is live).

Development is documented in `docs/`: the contributing guide, internals notes, and ADRs.
