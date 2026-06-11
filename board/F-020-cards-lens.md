---
id: F-020
type: feature
title: Cards lens — a flat, filterable index of every card
status: Draft
priority: P2
phase: Phase 3
owner: mozart
dependsOn: [F-019]
created: 2026-06-11T23:00:00Z
updated: 2026-06-11T23:00:00Z
---

# F-020 — Cards lens — a flat, filterable index of every card

The board answers "how is this sprint going"; nothing answers "show me everything".
After this feature a new top-level **Cards** lens lists every card in the vault — the
issues-index view — filterable, sortable, and bookmarkable, reusing the board's filter
bar.

## Outcome

- A **Cards** entry joins the lens navigation (Wiki · Board · Cards · Graph), routed at
  `/cards` (lazy, like the others — ADR-004).
- A dense list/table of all cards: id (mono), type badge, title, status, priority,
  owner, sprint, updated — columns derived from the config's `fields` registry and type
  definitions, not hardcoded.
- The F-019 filter bar on top (type, priority, owner, text) plus status/sprint filters
  and column sorting; all state URL-persisted; a result count.
- Container cards appear with their children-progress chip once F-022 lands; until then
  they render as plain rows.
- Clicking a row opens the card the same way the board does (reader today; peek/page
  once F-021 ships). Rows are keyboard-reachable.

## Context — read before starting

- ADR-018 in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — cross-sprint browsing
  belongs here, not on the board.
- [`apps/web/src/app/app.routes.ts`](../apps/web/src/app/app.routes.ts) and
  [`apps/web/src/app/app.html`](../apps/web/src/app/app.html) — lens routing/navigation
  to extend.
- F-019's filter bar component — reuse, don't fork.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — list density, mono ids,
  badge idioms.

## Constraints (must honor)

- **Config-driven** (ADR-003): visible columns and filter options come from config;
  a vault with custom types/fields gets a correct table with zero code changes.
- **Read-only** (ADR-002); sorting/filtering are computed in the view over the loaded
  vault model — no new endpoints.
- **One filter bar:** any filter capability added here must land in the shared component
  so board/backlog get it too.

## Plan

1. Route + navigation entry; view skeleton with the shared filter bar and URL-persisted
   sort/filter state.
2. Column model derived from config (`fields` registry + per-type card fields);
   daisyUI `table` (sm, zebra-free, hairline) per the design system.
3. Row interaction: open card (current reader navigation; upgraded by F-021), keyboard
   navigation, count display, empty state.
4. Specs: filtering/sorting/URL round-trip, config-driven columns (recipe-box fixture),
   a11y pass.

## Acceptance

- [ ] `/cards` lists every card in the vault with config-derived columns; recipe-box
      renders correctly with no code changes.
- [ ] Filters and sort compose, persist in the URL, and show a result count; the same
      filter bar component serves board, backlog, and cards.
- [ ] Rows open the card exactly like board cards do, and are fully keyboard-operable.
- [ ] AXE passes; the view follows the design-system list idioms in both themes.

## Dependencies

- **Depends on:** F-019 (shared filter bar). **Blocks:** —

## Out of scope

Card detail surfaces (F-021), container progress chips (F-022), saved/custom views,
grouping, and bulk actions (write-mode, far future).

## References

ADR-002, ADR-003, ADR-004, ADR-018; `docs/13-DESIGN_SYSTEM.md`.
