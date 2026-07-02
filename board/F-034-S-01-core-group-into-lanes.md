---
id: F-034-S-01
type: story
title: Core — group placed leaves into parent lanes
status: Todo
priority: P2
owner: mozart
parent: F-034
estimate: S
touches: [core]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T11:00:00Z
---

# F-034-S-01 — Core: group placed leaves into parent lanes

The shared enabler for the swimlane board (F-034): a pure function that turns the board's
already-placed leaf cards into an ordered list of lanes, plus the config plumbing for the new
`board.laneField` key. The web render (F-034-S-02) and the validator read this one source
instead of re-deriving grouping view-side.

## Outcome

- `packages/core` exposes `groupIntoLanes(model, config, cards)` returning an ordered
  `Lane[]`, where a `Lane` carries its key, an optional header (the container card + its
  children-progress rollup) and the per-column leaf lists. Pure, exported from the barrel
  ([`packages/core/src/index.ts`](../packages/core/src/index.ts)).
  - `laneField` absent ⇒ exactly one unnamed, header-less lane holding every placed leaf
    (today's flat board).
  - `laneField: "parent"` ⇒ one lane per container that has ≥1 visible leaf, ordered by the
    container's `sortWithinColumn` rank (priority, id), plus a trailing "No parent" lane for
    orphan/dangling-parent leaves.
  - `laneField: <registered field>` ⇒ one lane per value (header = value label, no progress),
    orphans trailing — built now, gated off in the view per F-034 (kept minimal here).
- Grouping runs **over placed leaves**: containers are lifted to headers, never assigned a
  column; hidden-state cards (`null`) stay hidden; placement errors are untouched.
- `board.laneField` is normalized and validated in
  [`config.ts`](../packages/core/src/config.ts), cloning the existing `board.scopeField`
  handling: the literal `"parent"` is accepted; any other value must name a registered field,
  else a diagnostic (never a throw), consistent with the lenient loader.
- The children-progress rollup reuses F-021/F-022's existing helper (done = last column via
  `isCardDone`), not a new "done" definition.

## Context — read before starting

- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `placeCard`,
  `sortWithinColumn`, `isCardDone`; lanes group the output of placement, they don't re-place.
- [`packages/core/src/relations.ts`](../packages/core/src/relations.ts) — `containerIds`,
  `childrenOf`, and the children-progress rollup to reuse.
- [`packages/core/src/scope.ts`](../packages/core/src/scope.ts) and
  [`config.ts`](../packages/core/src/config.ts) — `normalizeScope` + the `board.scopeField`
  validate branch are the exact template for `laneField`.
- [`packages/core/src/index.ts`](../packages/core/src/index.ts) — the barrel new exports join.
- [ADR-001](../docs/08-DECISIONS.md), [ADR-003](../docs/08-DECISIONS.md) — pure, config-driven.

## Constraints (must honor)

- **Pure (ADR-001):** function of model + config + cards; no I/O, no `Date.now`, no throw;
  unresolved ids reported/skipped, not crashed on.
- **Config-driven (ADR-003):** `"parent"` is derived from `containerIds`; other values are
  field names; no type name is hardcoded. Absent `laneField` reproduces the flat board.
- **Don't touch placement or states:** `placeCard` and the per-type `states` maps are unchanged.

## Plan

1. Add `Lane` type + `groupIntoLanes` (parent + field + none modes) reusing the helpers above.
2. Add `board.laneField` to the board config type + `normalize`/`validate` (clone `scopeField`).
3. Export from the barrel.
4. Vitest: lane order, "No parent"/orphan lane, dangling parent, hidden-state still hidden,
   progress rollup correctness, `laneField` absent = single flat lane, invalid `laneField`
   diagnosed not thrown.
5. Gate: `bunx vitest run` in `packages/core`.

## Acceptance

- [ ] `groupIntoLanes` is exported and pure; `laneField` absent yields one flat lane identical
      to today's placement.
- [ ] `"parent"` mode produces one lane per non-empty container ordered by `sortWithinColumn`,
      a trailing "No parent" lane, container headers carrying an accurate *n/m done* rollup, and
      no container in any column.
- [ ] Hidden-state cards stay hidden; a dangling `parent` lands in "No parent" and is not fatal;
      placement errors are unaffected.
- [ ] `board.laneField` is validated like `board.scopeField` (accept `"parent"` or a registered
      field; diagnose otherwise, never throw).
- [ ] Tests cover every behavior above and `packages/core` is green.

## Dependencies

- **Depends on:** — (reuses F-022's rollup, already Done). **Blocks:**
  [F-034-S-02](F-034-S-02-board-lanes-render.md).

## Out of scope

The web render, lane header UI, collapse, totals strip, and type-facet gating
(F-034-S-02/S-03); docs + the ADR amendment (F-034-S-04). Core + config only.

## References

F-034; F-022; [`packages/core/src/relations.ts`](../packages/core/src/relations.ts);
[`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts);
[ADR-001](../docs/08-DECISIONS.md), [ADR-003](../docs/08-DECISIONS.md).
