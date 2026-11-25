# ADR 0002: Gherkin BDD contract

Date: 2026-11-25 · Status: Accepted

## Context

The app has no lint or typecheck tooling, and its riskiest logic is behavioral:
the never-overwrite naming rule, batch save/zip semantics, folder pick vs
download, the develop loop. Manual QA catches regressions only when someone
happens to click the right path. The project needed a test harness that states
behavior in language the product docs can reuse, and a gate that stops a
breaking change before it lands on `main`.

## Decision

Behavior is specified in Gherkin with playwright-bdd:

- Feature files live in `features/` at the repository root.
- A scenario is written **before** the behavior it covers; a behavior change
  lands with its scenario (red first, then green).
- Scenarios are named for the behavior, not the code ("saving never overwrites
  an existing strip name", not "test candidateName").
- `npm run test:bdd` runs `npx bddgen && npx playwright test`; generated specs
  land in `.tmp/` (gitignored). Chromium is installed once with
  `npx playwright install chromium`.
- The suite is a CI gate (`.github/workflows/bdd.yml`) on every push and PR;
  the deploy workflow runs after it.

The BDD suite replaces lint/typecheck as the project's verification standard,
alongside the manual serve smoke test.

## Consequences

- Product laws ([The Laws](../laws.md)) are pinned by scenarios, so a change
  that weakens one fails CI instead of shipping.
- Specs are generated, so `features/` is the single source of truth; never edit
  generated step bundles by hand.
- Tests drive the real browser against the real app (`window.__darkroom` and
  the `api` test helpers `fromFiles`/`fromDirHandle`/`_lastDownload` exist for
  this), not a mock DOM.
- CI needs Chromium in the runner image; playwright version bumps touch the
  workflow, not the app.
