# Self-Hosting

The web app is a static site. You can host it anywhere; the intended home is
GitHub Pages.

## GitHub Pages flow

1. Create a GitHub repository and push this project to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**. This is the one step the workflow cannot do for you.
3. Each push to `main` runs the deploy workflow (`.github/workflows/pages.yml`),
   which builds `web-dist/`, builds these MkDocs docs into `web-dist/docs/`,
   and publishes the site. You can also run it by hand from the **Actions** tab
   ("Deploy web app to GitHub Pages" → Run workflow).
4. The site address appears in the workflow run and under Settings → Pages,
   usually `https://<user>.github.io/<repo>/`. The docs live under `/docs/`.

Nothing deploys from a developer machine. The Pages workflow on `main` is the
only deploy path.

## Local preview

```sh
npm run serve:web
```

This builds into `web-dist/` and serves it at
[http://localhost:5178](http://localhost:5178) (`PORT` overrides the port).

To preview the docs site alone:

```sh
python3 -m venv .tmp/venv
.tmp/venv/bin/pip install mkdocs-material
.tmp/venv/bin/mkdocs serve
```

## The build needs no npm install

The web build itself runs `build/make-icon.js` and `build/build-web.js`, both
plain Node scripts with zero dependencies. `npm install` is only needed for the
test suite (playwright-bdd).
