---
id: F-036-S-04
type: story
title: Incremental watch re-index for live search
status: Todo
priority: P2
owner: mozart
parent: F-036
estimate: S
touches: [web, core]
created: 2026-07-04T10:00:00Z
updated: 2026-07-04T12:00:00Z
---

# F-036-S-04 — Incremental watch re-index for live search

Until this lands, the wiki search rebuilds its index on entry (correct, just not
live). This wires the index to the vault watcher so add/edit/delete of a file
updates results without a full reload — mirroring how the model already
live-patches (`applyFileChange`).

## Outcome

- The `SearchIndexService` subscribes to `source.watch(path)` and calls
  `applySearchChange(index, config, path, file | null)` (from S-01) per change:
  - edit/add: re-`readFile` + `parseFile` that one path (watch delivers only the
    path, so the body is re-fetched — the wiki already does this) → replace/add.
  - delete (unreadable): remove that path.
  - `.mos/config.json` change: **full rebuild** (scope globs moved).
- Open search results reflect vault edits live, with per-file cost (not a
  whole-vault rebuild) for ordinary edits.
- The watcher subscription is torn down with the service (no leak).

## Context — read before starting

- [`packages/core/src/models.ts`](../packages/core/src/models.ts) —
  `applyFileChange` (the contract `applySearchChange` mirrors) and the
  config-change → full-reload rule the board/wiki already follow.
- [`apps/web/src/views/wiki/wiki-view.ts`](../apps/web/src/views/wiki/wiki-view.ts)
  / [`board-view.ts`](../apps/web/src/views/board/board-view.ts) — `source.watch`
  usage: re-parse the changed path, config change → full reload, unwatch on
  destroy.
- The `SearchIndexService` from S-02 and `applySearchChange` from S-01.

## Constraints (must honor)

- Pure core stays pure (`applySearchChange` is pure; the I/O + subscription live in
  the service).
- Read-only (ADR-002).
- Match the model's live-update semantics exactly (config change ⇒ full rebuild;
  otherwise per-path) so search and the model never disagree on scope membership.
- Unsubscribe on destroy (no watcher leak).

## Plan

1. Subscribe the `SearchIndexService` to `source.watch`; route per-path changes
   through `applySearchChange`; `.mos/config.json` → rebuild.
2. Re-fetch the changed file's body (watch gives only a path).
3. Tear down on destroy; specs for add/edit/delete + config-change rebuild.

## Acceptance

- [ ] Adding, editing, or deleting a vault file updates open search results
      without a full page reload; ordinary edits cost per-file, not a full rebuild.
- [ ] A `.mos/config.json` change rebuilds the index (scope globs re-applied).
- [ ] The watch subscription is disposed with the service (no leak).
- [ ] Web + core tests green.

## Dependencies

- **Depends on:** F-036-S-01 (`applySearchChange`) and F-036-S-02 (the service).
  **Blocks:** —

## Out of scope

Any new query/UI behavior; the engine and wiki search themselves (S-01/S-02).

## References

F-036; [`packages/core/src/models.ts`](../packages/core/src/models.ts)
(`applyFileChange`); [`apps/web/AGENTS.md`](../apps/web/AGENTS.md).
