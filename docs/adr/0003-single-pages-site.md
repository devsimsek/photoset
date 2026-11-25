# ADR 0003: Single Pages site

Date: 2026-11-25 · Status: Accepted

## Context

The app is a static site and the docs are an MkDocs site. Two options: host
them as separate Pages deployments (two URLs, two workflows, two "Sources" to
arm) or serve both from one site. The app is the product; the docs explain it.
Splitting them doubles the owner-gated setup work (see PS-7) and makes the docs
URL drift from the app URL.

## Decision

One GitHub Pages site serves both: the app at `/` and the docs at `/docs/`.
The deploy workflow (`.github/workflows/pages.yml`) builds `web-dist/` from
`src/renderer/`, builds the MkDocs docs into `web-dist/docs/`, and publishes
`web-dist/` as the site root. A `.nojekyll` keeps Pages serving files as-is.

## Consequences

- One workflow, one Pages arming step, one URL:
  `https://<user>.github.io/<repo>/` with docs under `/docs/`.
- `mkdocs.yml` sets `site_url` under `/docs/` so generated links and canonical
  URLs are correct in the deployed layout.
- Docs validation builds never write into `web-dist/` (the workflow owns that
  path); local checks go to `.tmp/mkdocs-site`.
- The docs build becomes part of the deploy gate: a broken `mkdocs.yml` or
  nav entry fails the deploy, which is the desired failure mode.
