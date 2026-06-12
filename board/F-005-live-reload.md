---
id: F-005
type: feature
title: Live reload on file change
status: Done
priority: P1
phase: MVP
owner: mozart
dependsOn: [T-004, T-002, F-001, F-003, F-004]
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# F-005 — Live reload on file change

When a file changes on disk (because the agent edited it), re-parse it and update the
views with no manual refresh. Closes the "AI writes / you see" loop.

## Outcome

After this feature, editing a vault file on disk — by hand or via an AI assistant — updates
the wiki and board with no manual refresh. The app subscribes to the `VaultSource` change
stream, re-parses only the changed file, updates the in-memory model, and the signal-based
views react. This is what makes mos feel live while staying read-only (the agent writes; the
app observes).

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Data flow #5 — the change → re-
  parse → view-update loop.
- [`docs/06-MVP.md`](../docs/06-MVP.md) Acceptance #2 — "editing a card's status moves it on
  the board without a manual refresh" is the MVP bar this feature meets.
- T-004 (the watcher emitting events) and T-002 (the change stream carrying them).
- F-001 (the re-parse pipeline to re-run on one file).

## Constraints (must honor)

- Read-only: react to changes; never write. (ADR-002)
- Re-index incrementally — re-parse only the affected file, not the whole vault, then merge
  into the model. (ADR-001, performance)
- Reactivity via signals (the stack's chosen mechanism for live updates). (ADR-005)

## Plan

Single story (F-005-S-01): subscribe to the change stream, re-parse the changed file, update
the model, let the signal views re-render. Depends on T-004 landing first.

## Acceptance

- [x] Changing a card's `status` on disk moves it on the board with no manual refresh.
- [x] A wiki file edit re-renders in the reader without a refresh.
- [x] Only the changed file is re-parsed (not a full reload).

## Stories

F-005-S-01

## Dependencies

- **Depends on:** T-004 (watcher), T-002 (change stream), F-001 (re-parse), F-003/F-004 (the
  views that react).
- **Blocks:** the MVP completing.

## Out of scope

The watcher itself (T-004) and any write path. App-side reactivity only.

## References

ADR-001, ADR-002, ADR-005; `docs/03-ARCHITECTURE.md`, `docs/06-MVP.md`.
