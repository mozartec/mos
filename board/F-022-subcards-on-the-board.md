---
id: F-022
type: feature
title: Subcards on the board — leaves in columns, containers as progress
status: Draft
priority: P2
phase: Phase 3
owner: mozart
dependsOn: [F-019, F-021]
created: 2026-06-11T23:00:00Z
updated: 2026-06-11T23:00:00Z
---

# F-022 — Subcards on the board — leaves in columns, containers as progress

Hierarchy exists in the data (`parent:` on stories) but not on the board: a feature and
its stories render as unrelated cards, and a container sitting in a column says nothing
about its children. After this feature the board's units are **leaf cards**, each showing
where it belongs; **containers** show up as computed progress in the list views instead
of occupying columns (ADR-019).

## Outcome

- **Board columns hold leaves only:** a card that other cards name as `parent` no longer
  renders in a column; column counts mean shippable units.
- **Parent breadcrumb chip** on child cards (mono id + truncated container title);
  clicking it opens the container's peek/page (F-021).
- **Container rows in lists** (Backlog, Cards lens) carry a children-progress chip —
  *n/m done* with a small bar — computed from the children's states (done = last
  column).
- A container's own page/peek already lists children (F-021); this card makes the
  board/list presentation consistent with it.
- Vaults without hierarchy (no `parent` fields configured or used) render exactly as
  today.

## Context — read before starting

- ADR-019 in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — the decision this
  implements, including why containers leave the columns.
- [`packages/core`](../packages/core) — parent/child resolution exists (graph lens,
  F-021's `childrenOf`); the board population rule changes where columns are computed.
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts)
  and [`apps/web/src/components/card`](../apps/web/src/components/card) — column
  population and the card component gaining the breadcrumb chip.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — chip and density idioms.
- [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md) — types/parent rules vocabulary.

## Constraints (must honor)

- **Config-driven** (ADR-003): "container" is derived from data (some card's `parent`
  points here), never from a type name; any type can be a parent if the config's parent
  rules allow it.
- **Pure core** (ADR-001): leaf/container classification and progress rollups are core
  functions with tests.
- **Nothing disappears:** every container excluded from columns must be reachable in
  Backlog/Cards with its progress chip — the board hides nothing that isn't visible
  elsewhere (placement-error reporting stays intact).
- **Read-only** (ADR-002).

## Plan

1. Core: `isContainer(id)`, `childProgress(id)` (done = mapped to last column), tests
   incl. multi-level parents (a container whose parent is also a container).
2. Board population: filter containers out of columns; keep them out of column counts;
   placement errors unaffected.
3. Card component: parent breadcrumb chip (navigates per F-021); design-system styling.
4. List views: progress chip + bar on container rows (Backlog, Cards).
5. Specs: board excludes containers, chip navigation, progress math, recipe-box
   (flat vault) unchanged.

## Acceptance

- [ ] No container card occupies a board column; column counts equal leaf cards; this
      vault's features with stories (e.g. F-001…F-004, F-012) disappear from columns and
      appear in lists with correct *n/m done*.
- [ ] Child cards show a parent breadcrumb chip that opens the container's peek; the chip
      truncates gracefully at board density.
- [ ] Progress chips compute from children's column mapping (done = last column),
      including multi-level hierarchies.
- [ ] recipe-box (no hierarchy) renders identically before/after; a stray `parent` to a
      missing id is reported, not crashed on.
- [ ] Core classification/rollup functions are pure and unit-tested.

## Dependencies

- **Depends on:** F-019 (board/backlog), F-021 (peek as the chip's target). **Blocks:** —

## Out of scope

Inline expansion of children inside board cards, swimlane/group-by-parent layouts
(possible future board option), drag/reorder, and any editing.

## References

ADR-001, ADR-002, ADR-003, ADR-019; `docs/13-DESIGN_SYSTEM.md`; F-019, F-021.
