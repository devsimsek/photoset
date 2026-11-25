# Ticket Ledger

Photoset Darkroom work is tracked here. One ticket = one commit series, committed with an
explicit pathspec, with evidence posted back on the ticket. Agents working in parallel claim
paths and never commit outside them.

| ID | Title | Status | Scope | Evidence |
| --- | --- | --- | --- | --- |
| PS-1 | Web-only strip (Electron removed) | Done | `package.json`, `build/`, `src/renderer/` | Commit `fd60baf`. Build clean, `serve:web` 200 smoke test. |
| PS-2 | Gherkin BDD harness (loading, developing, saving, naming) | In Progress (agent) | `features/`, playwright config, `package.json` | Suite in progress; scenarios for load, develop, save, naming. |
| PS-3 | Pages deploy + BDD gate workflows | In Progress (agent) | `.github/` | `pages.yml` and `bdd.yml` in progress. |
| PS-4 | Docs + ADRs | In Progress (this ticket) | `tickets.md`, `docs/`, `mkdocs.yml` | This commit. MkDocs build zero errors; output kept out of `web-dist/`. |
| PS-5 | LICENSE + README rewrite | In Progress (agent) | `LICENSE`, `README.md` | Rewrite in progress. |
| PS-6 | AGENTS.md | Open | `AGENTS.md` | Not started. |
| PS-7 | Git repo to GitHub, Pages arming, tag v0.0.1 | Open (owner-gated deploy) | GitHub repo settings, Pages, tags | Owner act: repo creation, Pages arming via `gh` cli. Nothing deploys from a machine. |

## Future waves (planned, not ticketed yet)

Ticketing happens when a wave starts. Scope may shift before then.

| Version | Theme |
| --- | --- |
| v0.1.0 | Export options |
| v0.2.0 | Film studio |
| v0.3.0 | PWA |
| v0.4.0 | Local storage / rolls |
| v0.5.0 | Mobile + QOL |
| v0.6.0 | RAW processing |
| v1.0.0 | 1.0 |
