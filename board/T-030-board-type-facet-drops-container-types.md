---
id: T-030
type: task
title: Board Type facet drops container-only types
status: Todo
priority: P2
phase: Phase 4
owner: mozart
touches: [web]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T11:00:00Z
---

# T-030 — Board Type facet drops container-only types

The board's Type filter offers every configured type, but the board renders **leaf** cards
only — containers are skipped (F-022 / ADR-019). So on a vault with a container type (e.g.
`feature`), selecting that type on the board matches only skipped cards and yields a
**silently empty board** with no explanation — a lying affordance: the board hides a whole
type its own facet still advertises. This is a small, self-contained fix, fully decoupled from the
swimlanes feature ([F-034](F-034-swimlanes-group-by-parent-lanes.md)) and shippable before it.

## Outcome

- On the **board surface only**, the Type facet omits container-only types — a type all of
  whose cards are containers (in `containerIds(model)`). The board's `facets` computed gains
  this gate next to the existing reserved-key filter; the **Cards lens keeps the full facet**
  (it lists containers, so filtering by them there is meaningful).
- Result: selecting a type on the board can no longer produce a silently empty board for a type
  that exists; the offered type options are exactly the ones the board can actually show.
- Prefer the view-side gate (no core change, no config): filter in
  [`board-view.ts`](../apps/web/src/views/board/board-view.ts)'s `facets` computed, mirroring
  how the board already drops reserved/scope facets. (An optional `buildFacets` predicate is a
  fallback if the logic is wanted in core — not required here.)

## Context — read before starting

- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) — the
  `facets` computed (already filters `RESERVED_URL_KEYS`) and the `containers` computed
  (`containerIds(model)`); the placement skip that makes containers invisible is the reason the
  facet lies.
- [`packages/core/src/filters.ts`](../packages/core/src/filters.ts) — `buildFacets` builds the
  Type facet from every `config.types`; the fix narrows it on the board, not here.
- [`packages/core/src/relations.ts`](../packages/core/src/relations.ts) — `containerIds`, the
  source of truth for "is a container".
- [ADR-003](../docs/08-DECISIONS.md) — config-driven; "container" stays data-derived, no type
  name hardcoded. [ADR-019](../docs/08-DECISIONS.md) — why the board shows leaves only.

## Constraints (must honor)

- **Config-driven (ADR-003):** container-only is derived from `containerIds`, never a hardcoded
  type name; a flat vault (no containers) offers every type exactly as today.
- **Board-only:** the Cards lens facet is unchanged.
- **Read-only (ADR-002):** filtering/faceting only; no writes.

## Plan

1. In the board's `facets` computed, drop any type facet option whose value is a type where
   every card of that type is in `containerIds(model)` (drop the whole `type` facet only if it
   would be left with <2 options — otherwise just the container-only options).
2. Spec/test: on a vault with a container type, the board Type facet omits it and the Cards lens
   keeps it; a flat vault's board facet is unchanged.

## Acceptance

- [ ] On a vault with a container type, that type is absent from the **board's** Type facet and
      present in the **Cards lens** facet.
- [ ] Selecting any offered type on the board never yields a silently empty board for a type
      that exists.
- [ ] A flat vault (no containers) offers every type on the board exactly as today.
- [ ] The gate derives from `containerIds` (no hardcoded type name); board specs green.

## Dependencies

- **Depends on:** — . **Related:** [F-034-S-02](F-034-S-02-board-lanes-render.md) folds this same
  gate into the swimlane board; the two touch the same code, so sequence them — whichever lands
  first, the other rebases. This task is intentionally shippable standalone; once F-034 surfaces
  containers as lane headers, this gate remains correct (container-only types still don't belong
  in the board's leaf-type facet).

## Out of scope

Swimlanes / making containers visible on the board (F-034); any empty-state messaging beyond
removing the misleading option; the Cards lens.

## References

F-034, F-034-S-02, F-022;
[`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts);
[`packages/core/src/filters.ts`](../packages/core/src/filters.ts);
[ADR-003](../docs/08-DECISIONS.md), [ADR-019](../docs/08-DECISIONS.md).
