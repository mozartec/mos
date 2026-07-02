---
id: F-034-S-02
type: story
title: Board — render lanes × columns with container headers
status: Done
priority: P2
owner: mozart
parent: F-034
estimate: M
touches: [web]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T14:30:00Z
---

# F-034-S-02 — Board: render lanes × columns with container headers

Turn the board from a column list into a lane × column grid using F-034-S-01's
`groupIntoLanes`. Containers become lane headers instead of being skipped into invisibility;
their leaves flow through the existing columns unchanged. This is the story that makes
features visible on the board.

## Outcome

- [`board-view.ts`](../apps/web/src/views/board/board-view.ts) consumes `groupIntoLanes` and
  the template ([`board-view.html`](../apps/web/src/views/board/board-view.html)) renders one
  band per lane: a lane header row followed by that lane's columns. Zero-config (no
  `laneField`) renders the single unnamed lane exactly as today.
- **Lane header** (in `"parent"` mode) shows the container card's id + title + type badge and
  the children-progress chip + bar; it spans the lane and sits in no column. Clicking it opens
  the container's side peek (reuse the existing `openPeek`/`?peek=` path) — the first time a
  container is reachable from the board.
- The container-skip currently at the `containers.has(card.id)` guard in the `placement`
  computed **moves into the header path**: containers are lifted to headers, still never placed
  in a column, and bad-type/status containers are still diagnosed (error collection stays first).
- **Board Type facet drops container-only types** (a type all of whose cards are containers),
  added to the board's `facets` computed alongside the existing reserved-key filter — so
  selecting a type on the board can't silently empty it. The Cards lens keeps the full facet.
  (If [T-030](T-030-board-type-facet-drops-container-types.md) has already shipped this, keep its
  behavior and don't duplicate; the two touch the same code and must be rebased, not both applied.)
- Leaf cards render exactly as today (same `CardComponent`, blocked badge, collision /
  safe-to-start overlays, breadcrumb chip, sort); a "No parent" lane holds orphan leaves.

## Context — read before starting

- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) — the
  `placement`, `columns`, `facets`, and `containers` computeds; `onCardSelect`/`openPeek`;
  `RESERVED_URL_KEYS`. The `parentOf`/`progressFor` helpers already feed cards F-022 data.
- [`apps/web/src/views/board/board-view.html`](../apps/web/src/views/board/board-view.html) —
  the Kanban columns block to restructure into lanes × columns.
- [`apps/web/src/components/card`](../apps/web/src/components/card) — the leaf card component,
  reused unchanged; the lane header is a new compact presentation of a container card.
- [`packages/core/src/filters.ts`](../packages/core/src/filters.ts) — `buildFacets` and how the
  board already narrows facets (the container-type gate rides here or in the view's `facets`).
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — chip/badge/density idioms.

## Constraints (must honor)

- **Read-only (ADR-002):** header/leaf clicks open the peek; no drag, reorder, or write.
- **Config-driven (ADR-003):** the view reads lanes from core; it hardcodes no type name; no
  `laneField` ⇒ today's board.
- **ADR-019 honored:** the container is a header spanning the lane, never a card in a column.
- **Nothing regresses:** leaf placement, counts (per-lane now; global totals land in S-03),
  blocked/collision/safe overlays, and placement-error reporting all survive.

## Plan

1. Swap the `columns` render for a lane iteration driven by `groupIntoLanes`.
2. Add the lane-header presentation (container card + progress chip/bar; header click → peek).
3. Move the container-skip into the header path; keep error collection first.
4. Add the container-only-type gate to the board's `facets` computed.
5. Component/host specs: lanes render, header opens peek, container never in a column, flat
   vault unchanged, container-only type absent from the board facet.

## Acceptance

- [x] With `laneField: "parent"`, the board shows a lane per container with a progress header
      and its leaves in the columns beneath; with no `laneField` it renders identically to today.
- [x] A container never appears inside a status column; clicking a lane header opens its peek.
- [x] The board Type facet omits container-only types; selecting a present type never yields a
      silently empty board; the Cards lens facet is unchanged.
- [x] Orphan leaves appear in a "No parent" lane; blocked/collision/safe overlays and
      placement-error reporting are unchanged.
- [x] Board specs green; recipe-box renders identically before/after.

## Dependencies

- **Depends on:** [F-034-S-01](F-034-S-01-core-group-into-lanes.md) (the core function + config).
  **Blocks:** [F-034-S-03](F-034-S-03-collapsible-lanes-and-totals.md).
- **Related:** [T-030](T-030-board-type-facet-drops-container-types.md) overlaps the type-facet
  gate — sequence, don't double-apply.

## Out of scope

Collapse/expand, the global column-totals strip, and the full AXE/WCAG pass (F-034-S-03);
docs + the ADR amendment (F-034-S-04); arbitrary-enum lane modes (F-034 Out of scope).

## References

F-034, F-034-S-01, F-021, F-022, T-030;
[`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts);
[ADR-002](../docs/08-DECISIONS.md), [ADR-019](../docs/08-DECISIONS.md).
