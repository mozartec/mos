---
id: F-015
type: feature
title: Standalone CLI — serve any vault
status: Planned
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [T-002]
created: 2026-06-10T10:33:00Z
updated: 2026-06-10T10:33:00Z
---

# F-015 — Standalone CLI — serve any vault

Today the only way to see a vault rendered is to clone the mos repo, run the dev server
with `VAULT_DIR` pointed elsewhere, and run the Angular dev build. This feature packages
the validated web app as a published CLI so any project — without cloning mos — gets the
board and wiki with one command.

## Outcome

From any folder containing a `.mos/config.json` (or with the vault path as an argument):

```bash
npx mos serve [dir] [--port 4200]
```

serves the **built** web UI over that folder: the same read-only board, wiki, and graph
lenses, backed by the same file-listing/read/watch endpoints the dev server exposes today
(ADR-006), bundled with the compiled Angular app as static assets in one npm package. No
vault config found → a clear error naming the expected file, not a blank app.

This is the lightweight sibling of the desktop app (F-007): same UI, no native shell, one
`npx` away.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) — the `VaultSource` seam; the CLI
  is `HttpVaultSource`'s server generalized and published.
- [`apps/dev-server/src/index.ts`](../apps/dev-server/src/index.ts) — the endpoints and
  `VAULT_DIR` handling to reuse; today it's dev-only by design (ADR-006).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-001/002/006/008; packaging a
  published CLI may deserve its own ADR (runtime choice: Bun-compiled binary vs Node).
- [`docs/11-RELEASING.md`](../docs/11-RELEASING.md) — versioning/publishing conventions the
  package must follow.

## Constraints (must honor)

- **Read-only** (ADR-002) — the CLI serves and watches; it gains no write endpoints.
- **Pure core** (ADR-001) — packaging adds no I/O to `packages/core`.
- **Config-driven** (ADR-003) — nothing about this repo's types/columns is baked into the
  served app.
- **The folder is the source of truth** (ADR-001) — no database, no copy of the vault.

## Plan

Feature-level; stories to be cut when this is picked up. The expected shape:

1. Extract the vault HTTP endpoints into a reusable server module shared with
   `apps/dev-server` (or promote dev-server into the CLI's serve mode).
2. Bundle the production web build as static assets served by the same process.
3. A `mos` bin with `serve [dir] [--port]`; vault discovery (nearest `.mos/config.json`)
   and a friendly failure when absent.
4. Package + publish pipeline (npm), runtime decision recorded as an ADR.
5. Docs: a "use mos in your project" page covering the CLI.

## Acceptance

- [ ] In a repo that is not mos, with a valid vault, one `npx`-style command renders the
      board and wiki over that folder — no cloning, no `bun run dev`.
- [ ] File changes in the vault appear in the UI without restart (watch works).
- [ ] Running it where no `.mos/config.json` resolves fails fast with a message naming the
      expected file.
- [ ] The served process exposes no write endpoint (ADR-002 holds).
- [ ] Packaging/runtime choice is recorded as an ADR; releasing docs cover publishing.

## Dependencies

- **Depends on:** T-002 (the dev server this generalizes). **Blocks:** F-016.

## Out of scope

Native desktop packaging (F-007), in-app editing (F-011), the MCP server (F-009),
multi-vault serving, auth/remote hosting — this is a local, read-only viewer.

## References

ADR-001, ADR-002, ADR-003, ADR-006, ADR-008; `docs/03-ARCHITECTURE.md`,
`docs/11-RELEASING.md`.
