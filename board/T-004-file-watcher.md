---
id: T-004
type: task
title: File watcher (debounced, atomic-save safe)
status: Todo
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
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
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-006 (dev fs server), ADR-002
  (read-only; watching is observation, not writing).

## Constraints (must honor)

- Lives in `apps/dev-server` (I/O at the edge); `packages/core` stays pure. (ADR-001)
- Observation only — never writes back. (ADR-002)
- Debounce + atomic-save tolerance are required, not nice-to-have: editors and agents
  routinely write via temp + rename.

## Plan

1. Watch `VAULT_DIR` with chokidar, scoped to markdown + `.mos/config.json`.
2. Debounce per path (coalesce a burst into one event after a quiet window).
3. On emit, attempt the read; on a transient failure (mid-write), retry a couple of times
   with small backoff before reporting.
4. Push normalized `{ path, kind }` events onto the T-002 change stream. Test with a
   simulated temp-file+rename and a mid-write read failure.

## Acceptance

- [ ] Editing a file emits exactly one change event after debounce; a broken read retries
      cleanly.
- [ ] A temp-file + rename save surfaces as a single change to the real path, not noise.
- [ ] Events flow through the T-002 change stream unchanged in shape.

## Dependencies

- **Depends on:** T-002 (server + stream). **Blocks:** F-005-S-01.

## Out of scope

The app-side re-index + view update (F-005-S-01) and Tauri's native watcher (T-005). Dev
watching + clean event emission only.

## References

ADR-001, ADR-002, ADR-006; `docs/03-ARCHITECTURE.md`, `docs/04-TECH_STACK.md`.
