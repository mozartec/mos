---
id: T-004
type: task
title: File watcher (debounced, atomic-save safe)
status: Todo
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T10:00:00Z
phase: MVP
priority: P1
owner: mozart
sprint: S3
---

# T-004 — File watcher

Watch the vault (chokidar in dev). Debounce events; tolerate temp-file+rename saves and a
transient mid-write parse failure with a retry. Emit per-file change events. Blocks F-005-S-01.

## Outcome

After this task, `apps/dev-server` watches the vault folder and emits clean, per-file change
events down the change stream the `HttpVaultSource` already exposes (T-002). Events are
debounced (one event per logical save), tolerant of editors that save via temp-file +
rename, and resilient to a transient mid-write read/parse failure (retry, don't crash). This
is the disk-side half of the "AI writes / you see" loop; F-005-S-01 is the app-side half.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Data flow #5 — a change leads to
  re-parsing only the affected file; the watcher feeds that.
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — chokidar for the dev watcher; the
  native watcher is Tauri's job later (T-005).
- T-002 — the dev server + the change-stream shape this populates.
- [`apps/dev-server/src/index.ts`](../apps/dev-server/src/index.ts) — the wiring point: the
  `clients: Set<(path) => void>` broadcast set and the `/vault/watch` SSE handler you feed.
  The SSE payload is `{ path }` (vault-relative) — this is the **exact shape**
  `HttpVaultSource.watch` parses, so don't widen it. Reuse the `relative(VAULT_DIR, …)` +
  `replaceAll(sep, '/')` normalization already in `listVaultFiles`/`safePath`.
- [`apps/web/src/sources/http-vault-source.ts`](../apps/web/src/sources/http-vault-source.ts)
  — the consumer: `new EventSource('/vault/watch')`, `JSON.parse(event.data) as { path }`.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-006 (dev fs server), ADR-002
  (read-only; watching is observation, not writing).

## Constraints (must honor)

- Lives in `apps/dev-server` (I/O at the edge); `packages/core` stays pure. (ADR-001)
- Observation only — never writes back. (ADR-002)
- Debounce + atomic-save tolerance are required, not nice-to-have: editors and agents
  routinely write via temp + rename.
- `chokidar` is **not yet a dependency of `@mos/dev-server`** (only transitive under Angular).
  Add it explicitly: `bun add -D chokidar` in `apps/dev-server`.
- Keep the SSE wire contract as `{ path }` — compute a `kind` internally for your own
  debounce/retry logic if useful, but don't put it on the wire (the app parses `{ path }` only).

## Plan

1. `bun add -D chokidar` in `apps/dev-server`. Extract the watcher into its own module
   (e.g. `src/watcher.ts` exporting `watchVault(dir, onChange): () => void`) so it's unit-
   testable without booting the HTTP server.
2. Watch `VAULT_DIR` with chokidar, scoped to `**/*.md` + `.mos/config.json` (mirror the
   allowlist used by `listVaultFiles`/`safePath`). Debounce per path (coalesce a burst into
   one event after a quiet window, ~50–100ms).
3. On a change, attempt the read; on a transient failure (mid-write), retry a couple of times
   with small backoff before reporting — never crash the server.
4. In `src/index.ts`, start the watcher next to `Bun.serve(...)` and, on each debounced
   change, call every `send` in the existing `clients` Set with the vault-relative `{ path }`.
5. Add a `"test": "bun test"` script to `apps/dev-server/package.json` and a `src/watcher.test.ts`
   (Bun's built-in runner — no extra dep). Cover: one debounced event per save; a
   temp-file+rename surfaces as a single change to the real path; a mid-write read retries cleanly.

## Acceptance

- [ ] Editing a file emits exactly one change event after debounce; a broken read retries
      cleanly.
- [ ] A temp-file + rename save surfaces as a single change to the real path, not noise.
- [ ] Events flow through the T-002 change stream unchanged in shape (`{ path }` over SSE).
- [ ] `chokidar` is a declared devDependency of `@mos/dev-server`; `bun run dev` still serves.
- [ ] `bun test` runs in `apps/dev-server` and the watcher tests pass.

## Dependencies

- **Depends on:** T-002 (server + stream). **Blocks:** F-005-S-01.

## Out of scope

The app-side re-index + view update (F-005-S-01) and Tauri's native watcher (T-005). Dev
watching + clean event emission only.

## References

ADR-001, ADR-002, ADR-006; `docs/03-ARCHITECTURE.md`, `docs/04-TECH_STACK.md`.
