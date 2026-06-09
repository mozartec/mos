---
id: T-002
type: task
title: Dev filesystem server + HttpVaultSource
status: Done
dependsOn: [T-001]
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T23:20:00Z
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# T-002 — Dev filesystem server + HttpVaultSource

Add `apps/dev-server`: a small Node server that reads a configured vault path (list/read
files) and exposes a change stream, proxied from the Angular dev server. Implement
`HttpVaultSource` against the `VaultSource` interface already defined in `packages/core`
(T-001), and swap it in for the `StaticVaultSource` stub.

## Outcome

After this task, `bun run dev` serves `apps/web` against a **real folder on disk**, not the
hardcoded `StaticVaultSource` stub. A new `apps/dev-server` (small Node service) lists and
reads files from a configured vault path and exposes a change stream; the Angular dev server
proxies to it. `apps/web/src/sources/HttpVaultSource` implements the `core` `VaultSource`
interface and is wired in as the default DI source. The UI and core are untouched by the
swap — proof that the adapter boundary works.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §The VaultSource adapter — the
  `HttpVaultSource` (dev) vs `TauriVaultSource` (desktop) split and why swapping changes
  nothing upstream.
- [`packages/core/src/vault-source.ts`](../packages/core/src/vault-source.ts) — the exact
  interface to implement (`listFiles`, `readFile`, `watch`).
- [`apps/web/src/sources/`](../apps/web/src/sources) — where `StaticVaultSource` and the
  `VAULT_SOURCE` DI token live today; `HttpVaultSource` joins them and becomes the default.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-006 (web-first, dev fs server),
  ADR-002 (read-only), ADR-008 (it's a new `apps/*` workspace package).
- [`.agents/skills/turborepo/`](../.agents/skills/turborepo) — consult before adding the new
  workspace package + its Turbo scripts.

## Constraints (must honor)

- **Read-only server**: list + read + watch only. No write endpoints. (ADR-002)
- **Core stays pure**: the `fs` access lives entirely in `apps/dev-server`; `packages/core`
  gains nothing. (ADR-001)
- **No UI/core change on swap**: only the DI binding of `VAULT_SOURCE` changes from the stub
  to `HttpVaultSource`. (ADR-006)
- New package wired via Bun workspaces + Turbo, not Nx; keep `angular.json` untouched.
  (ADR-008)
- The watcher implementation itself is **T-004**; here just expose the change stream shape
  the source consumes.

## Plan

1. Create `apps/dev-server` (Node + TypeScript): endpoints to list files and read a file by
   path under a configured `VAULT_DIR`, plus a change-event stream (SSE or WebSocket).
2. Add it to the workspace; add Turbo `dev`/`build` scripts; proxy `/vault/*` from the
   Angular dev server to it.
3. Implement `apps/web/src/sources/http-vault-source.ts` against `VaultSource`; bind it to
   `VAULT_SOURCE` as the default, leaving `StaticVaultSource` available for tests.
4. Verify the web app renders this repo's files through the server.

## Acceptance

- [x] The app loads a real folder's files through `HttpVaultSource`; no direct disk access in
      the UI, and `packages/core` stays pure.
- [x] `bun run dev` brings up both the Angular app and the dev server together.
- [x] Swapping back to `StaticVaultSource` requires only a DI binding change.

## Dependencies

- **Depends on:** T-001. **Blocks:** F-001/F-003/F-004 running on real data; F-005 (live
  reload needs the change stream); T-004 (the real watcher behind the stream).

## Out of scope

The production-grade watcher (T-004), Tauri's `TauriVaultSource` (T-005), and any write path.
Dev read + change-stream plumbing only.

## References

ADR-001, ADR-002, ADR-006, ADR-008; `docs/03-ARCHITECTURE.md`;
`packages/core/src/vault-source.ts`.
