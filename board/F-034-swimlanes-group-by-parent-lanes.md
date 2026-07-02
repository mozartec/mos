---
id: F-034
type: feature
title: Swimlanes — group-by-parent lanes on the board
status: Done
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [F-022]
touches: [core, web, docs]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T14:30:00Z
---

# F-034 — Swimlanes — group-by-parent lanes on the board

The board is a one-dimensional surface (columns) carrying a two-dimensional problem.
Columns already own one axis — **state**: each type's `states` map collapses its own
vocabulary (`Draft`/`Todo` → Backlog, `Blocked` → In Progress + badge, `null` → hidden)
into the shared columns, which is mos's Linear-style status-category layer and works today.
The second axis is **altitude** — feature vs story vs task. With only the column axis, a
container (feature) has nowhere honest to sit: ADR-019 rightly keeps it out of the columns
(a feature isn't *in* "In Progress"; its children are), and F-022 sent containers to the
list views. On the board that leaves them invisible — and the Type facet still offers
"Feature", which then matches only skipped cards and silently empties the board.

This feature gives altitude its own axis: opt-in **swimlanes**. Columns keep owning state;
a new presentational vertical axis groups leaf cards by their container, and the feature
renders as a **lane header carrying computed progress** — never as a card asserting a
lifecycle it doesn't have. This is the Jira "swimlanes by epic" / Azure DevOps / Linear
shape, read-only. Zero-config vaults render exactly as today.

Scope note: the type registry declares a single containment level (`story.parent = feature`;
`task.parent = null`), so this delivers **two altitudes** — a container lane and its leaf
cells — which covers this vault and the common case. A genuine 3-deep feature → story → task
tree needs a deeper parent chain and is explicitly out of scope (§Out of scope).

## Outcome

- **A new optional board key, `board.laneField`.** Absent ⇒ a single unnamed lane ⇒ today's
  flat board, byte-for-byte (the additive-opt-in shape ADR-020 / F-028 established). The
  literal value `"parent"` selects data-derived container lanes; any other value must name a
  registered field (owner, phase, …), so grouping generalizes without hardcoding "feature".
- **Lanes are a pure projection.** One new core function turns the placed leaves into an
  ordered list of lanes; the board paints lanes × columns instead of a column list. Each leaf
  still lands in its column via its own type's `states` map — per-type lifecycles untouched.
- **Containers become lane headers, not column cards.** In `"parent"` mode each lane header
  is the container card (title, type badge) with the existing children-progress chip
  (*n/m done*, reusing F-021/F-022's rollup) and a thin bar; it spans the lane and never
  occupies a status column, so ADR-019's invariant holds literally. Clicking the header opens
  the container's side peek (F-021) — containers are finally reachable from the board.
- **The board's Type facet stops lying.** Container-only types (every card of that type is a
  container) drop out of the *board's* type facet, mirroring how the board already excludes
  the scope field; the Cards lens keeps the full facet. (The decoupled quick win for this ships
  independently as T-030; if it has already landed, this feature simply keeps that behavior.)
- **Collapsible lanes, collapsed by default.** A many-container vault opens as a portfolio
  view — one progress row per container — and expands to the working view. Collapse state is
  URL-driven (shareable, survives reload), like `?scope=`/`?peek=`.
- **A sticky global column-totals strip** keeps "column count = shippable leaves" (an ADR-019
  consequence) readable once per-lane counts split the totals across lanes.
- **Nothing disappears and nothing crashes:** orphan leaves collect in a trailing "No parent"
  lane; a dangling `parent` id is still validator-reported, not fatal; placement errors are
  still surfaced (grouping runs *after* placement).

## Context — read before starting

- [ADR-019](../docs/08-DECISIONS.md) in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) —
  the decision this extends: containers don't occupy columns because their status is a
  computed rollup, not an asserted state. This feature keeps that true (headers span lanes)
  and needs a **new ADR amending 019** to say containers now surface as lane headers on the
  board, not only in list views (S-04).
- [ADR-020](../docs/08-DECISIONS.md) (scope) and
  [F-028](F-028-config-named-in-flight-columns.md) — the additive-opt-in, zero-config-default
  precedent `laneField` follows; scope is the *horizontal* slicer, lanes the *vertical*
  grouping — orthogonal, never folded into one control.
- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `placeCard`,
  `sortWithinColumn`, `isCardDone` (done = last column); placement is unchanged, grouping runs
  over its output.
- [`packages/core/src/relations.ts`](../packages/core/src/relations.ts) — `containerIds`,
  `childrenOf`, and the children-progress rollup the lane header reuses verbatim.
- [`packages/core/src/scope.ts`](../packages/core/src/scope.ts) /
  [`config.ts`](../packages/core/src/config.ts) — `normalizeScope` and the existing
  `board.scopeField` normalization + validation are the template for `laneField`.
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) — the
  `placement` computed (containers skipped at the `containers.has(card.id)` guard — that skip
  moves into the header path), the `facets` computed (where the board already drops reserved
  keys — add the container-type gate), and `RESERVED_URL_KEYS` (reserve the new collapse
  param); the URL-driven scope/peek switchers are the pattern the collapse control copies.
- [`apps/web/src/views/board/board-view.html`](../apps/web/src/views/board/board-view.html) —
  the columns render to rework into a lane × column grid.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — chip/badge/density idioms for the
  lane header; [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md) — types/parent/lens vocabulary.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — the WCAG AA / AXE bar the 2-D grid must meet.

## Constraints (must honor)

- **Pure core (ADR-001).** Lane assignment/ordering is a pure function of the model + config +
  the already-filtered cards — no I/O, no `Date.now`, no throw; the view stays a projection.
- **Read-only (ADR-002).** Lanes, collapse, and grouping are presentational only — no drag, no
  reorder, no status write. Clicks open the peek; collapse toggles a URL param.
- **Config-driven (ADR-003).** No hardcoded feature/story/task. "Container" stays data-derived
  (`containerIds`); `laneField` is a field name, not a type name. Zero-config = today's board.
- **ADR-019 honored, then amended in the open.** A container never sits in a status column; it
  becomes a lane header whose progress is computed. The amendment is a recorded ADR, not a
  silent behavior change.
- **Divergent lifecycles preserved.** `placeCard` and the per-type `states` maps are untouched;
  lanes add a vertical axis only.
- **recipe-box (flat vault) renders identically** before/after; timestamps/ids per
  [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md).

## Plan

1. **Core (S-01):** `groupIntoLanes(model, config, visibleCards)` + a `Lane` type, reusing
   `containerIds`/`childrenProgress`/`placeCard`/`sortWithinColumn`; `board.laneField`
   normalization + validation (clone the `scopeField` check) + a `"No parent"` trailing lane;
   one test per behavior (lane order, orphan lane, hidden-state still hidden, progress rollup,
   absent `laneField` = flat board).
2. **Board render (S-02):** iterate lanes × columns; lane header = container card + progress
   chip, header click opens the peek; move the container-skip into the header path; drop
   container-only types from the board's Type facet.
3. **Portfolio polish (S-03):** collapsible lanes **collapsed by default**, URL-driven; sticky
   global column-totals strip; AXE/WCAG pass (lane headers as regions, `aria-expanded`,
   keyboard traversal, horizontal scroll confined to the grid).
4. **Spec + ADR (S-04):** document `board.laneField` in
   [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md); add the ADR amending ADR-019; pointer
   from [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md).

## Acceptance

- [x] With no `board.laneField`, the board renders byte-for-byte as today (single unnamed
      lane, no chrome); recipe-box is unchanged.
- [x] With `board.laneField: "parent"`, each container renders as a lane header with an
      accurate *n/m done* chip and never occupies a status column; its leaves flow through the
      columns beneath it via their own `states` maps.
- [x] Leaves with no/dangling `parent` collect in a trailing "No parent" lane; a dangling id is
      reported by the validator, not crashed on; placement errors still surface.
- [x] Clicking a lane header opens the container's side peek (F-021).
- [x] The board's Type facet no longer offers container-only types; selecting a type on the
      board never yields a silently empty board for a type that exists; the Cards lens still
      offers every type.
- [x] Lanes are collapsible and **collapsed by default**; collapse state round-trips through the
      URL; the sticky global column-totals strip shows correct totals.
- [x] `groupIntoLanes` and the `laneField` validation are pure and unit-tested; `board` view is
      unchanged for vaults that don't set `laneField`; `bun run validate` is green.
- [x] AXE/WCAG AA pass on the lane × column grid.

## Dependencies

- **Depends on:** [F-022](F-022-subcards-on-the-board.md) (leaf/container classification and
  the children-progress rollup this reuses; Done) — which itself parks "swimlane/group-by-parent
  layouts (possible future board option)" in its own Out of scope. Header navigation reuses
  [F-021](F-021-card-page-and-peek.md) (the peek; Done). **Blocks:** —
- **Related (decoupled):** [T-030](T-030-board-type-facet-drops-container-types.md) is the
  standalone quick fix for the misleading Type facet; it and this feature touch the same board
  facet code, so sequence them (whichever lands first, the other rebases). T-030 is
  intentionally shippable *before* any lane work.

## Out of scope

- **A true 3-deep feature → story → task tree** (nested lanes / deeper parent chain). This
  feature delivers two altitudes only; 3-deep needs a deeper containment level and its own ADR.
- **Grouping by an arbitrary enum at launch** (owner / phase / area). `laneField` is built to
  accept any registered field, but v1 ships gated to `"parent"`; a multi-valued field like
  `touches` also needs a card-in-multiple-lanes vs primary-value rule — a separate future card.
- **Any writing** — drag, reorder, inline status edits (ADR-002 holds); lanes are projection only.
- **Changes to the graph/wiki/cards lenses** beyond the shared core function.

## References

[ADR-001](../docs/08-DECISIONS.md), [ADR-002](../docs/08-DECISIONS.md),
[ADR-003](../docs/08-DECISIONS.md), [ADR-019](../docs/08-DECISIONS.md),
[ADR-020](../docs/08-DECISIONS.md); [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md);
[`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md); F-022, F-021, F-028; T-030.
