# Contributing

Photoset Darkroom is small on purpose: no framework, no bundler, no lint or
typecheck tooling. Verification is the Gherkin suite plus manual serve.

## Commands

```sh
npm run serve:web   # build into web-dist/ and serve at http://localhost:5178
npm run build:web   # build only
npm run icon        # regenerate src/renderer/icon.png
npm run test:bdd    # Gherkin suite (npx bddgen && npx playwright test)
```

`npm run test:bdd` needs `npx playwright install chromium` once. Generated spec
files land in `.tmp/` (gitignored). `npm install` is only needed for the test
suite; the build scripts have zero runtime dependencies.

## The Gherkin contract

Behavior changes land with a scenario written first, in `features/`, named for
the behavior. The scenario fails before the change and passes after. The BDD
suite is a CI gate on every push and PR, so a scenario that stops matching the
product blocks the merge instead of rotting.

## Ticket discipline

- Tickets live in `tickets.md` (PS-n). One ticket = one commit series.
- Commit messages follow `[PS-n] type(scope): message`.
- Agents working in parallel commit with explicit pathspecs, never `git add -A`,
  and verify `git show --stat HEAD` lists only their files.
- Evidence goes back on the ticket: commit hash, red/green proof for behavior
  changes.

## Bundle ceiling

The app ships 150 KB of JavaScript + CSS, a ratchet that never rises. `npm run
build:web` prints the total; a change that pushes past the ceiling must remove
bytes before it lands. No new runtime dependencies without an ADR.
