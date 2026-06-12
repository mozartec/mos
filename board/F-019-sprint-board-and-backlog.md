---
id: F-019
type: feature
title: Sprint board & backlog — one sprint at a time
status: Dropped
priority: P1
phase: Phase 3
owner: mozart
dependsOn: [F-018]
created: 2026-06-11T23:00:00Z
updated: 2026-06-12T18:30:00Z
---

# F-019 — Sprint board & backlog — one sprint at a time

Today the board renders every card at once with a lone sprint `<select>`. After this
feature the board is scoped the way teams actually work: one sprint at a time with a
switcher and a filter bar on top, and a separate **Backlog** view — a priority-ranked
list of everything not yet scheduled into a sprint.

## Outcome

- **Config (spec 0.3 → 0.4, additive — ADR-017):** a `sprints` entry is a string *or*
  `{ "name", "starts"?, "ends"? }`. Core normalizes both forms and resolves the
  *current* sprint purely (dates win; fallback: last sprint with unfinished cards, then
  the user's last selection; the clock is a function input).
- **Board scope (ADR-018):** the board shows one sprint's cards at a time — header with
  sprint name, prev/next, a sprint picker, and "n days left" when dates exist. Vaults
  with no `sprints` config keep an unscoped board and show no sprint UI.
- **Filter bar:** type, priority, owner, and free-text filters above the columns, built
  from the config's `fields` registry (nothing hardcoded), composable, and persisted in
  the URL so a filtered board is bookmarkable/shareable (consistent with the existing
  `from`/`sprint` deep-link pattern).
- **Backlog view:** a ranked list (priority, then id) of non-done cards whose sprint is
  empty — reachable from the board header as the board's sibling scope. Cards open the
  same way board cards do.

## Context — read before starting

- ADR-017 and ADR-018 in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — the sprint
  model and the backlog definition (backlog ≠ the "Backlog" column).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — §config `sprints` (gains the
  object form; bump `specVersion` guidance to 0.4) and §6 field order (untouched).
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts)
  / `.html` — the current board + sprint filter this replaces.
- [`packages/core`](../packages/core) — where sprint normalization/current-sprint
  resolution live as pure functions (ADR-001).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — learns the object form
  (and flags malformed dates).
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — filter-bar and density
  idioms; build on F-018's tokens.

## Constraints (must honor)

- **Pure core** (ADR-001): sprint parsing/selection take plain data + a `now` argument —
  no `Date.now()` inside core, no I/O.
- **Config-driven** (ADR-003): filter fields, sprint names/dates, columns — all from
  config. **Read-only** (ADR-002): scheduling a card into a sprint stays an agent-layer
  edit.
- **Backward compatible:** string-only `sprints` (this vault, recipe-box) parse and
  behave exactly as before apart from the new scope UI; a dateless vault never shows a
  countdown.
- **Spec discipline:** `docs/05-VAULT_SPEC.md` §sprints documents both forms with the
  0.4 bump in the same PR that ships the parser.

## Plan

1. Core: `normalizeSprints(config)` → `{ name, starts?, ends? }[]`;
   `resolveCurrentSprint(sprints, cards, now, lastSelection?)`; unit tests (dates,
   fallbacks, malformed input).
2. Validator: accept both forms; warn on bad/overlapping dates; keep string vaults
   warning-free.
3. Board header: scope switcher (sprint picker + prev/next + days-left) replacing the
   `<select>`; "Backlog" as the adjacent scope; URL carries scope.
4. Filter bar component (config-driven fields, URL-persisted state) rendered on both
   board and backlog; shared so F-020 can reuse it.
5. Backlog view: ranked list (priority then id), same card-open behavior, empty-state
   per design-system idioms.
6. Spec + `docs/12-ADOPTING.md` touch-ups; `bun run validate`; specs for scope switching,
   fallback resolution, URL persistence.

## Acceptance

- [ ] A vault with dated sprints opens the board on the date-current sprint and shows
      days remaining; prev/next and the picker switch scope; the URL round-trips it.
- [ ] This repo's vault (string sprints) still validates and renders; current-sprint
      fallback picks the last sprint with unfinished cards; no countdown shown.
- [ ] Backlog lists exactly the non-done, sprint-less cards, ranked by priority then id —
      regardless of status column.
- [ ] Filters (type, priority, owner, text) compose, persist in the URL, and apply on
      both board and backlog; options come from config, not code.
- [ ] `docs/05-VAULT_SPEC.md` documents the sprint object form under spec 0.4; the
      validator accepts both forms and flags malformed dates; core functions are pure
      and unit-tested.
- [ ] A vault with no `sprints` config shows today's unscoped board with no sprint UI.

## Dependencies

- **Depends on:** F-018 (build on the new tokens once). **Blocks:** F-020, F-021, F-022.

## Out of scope

Editing/scheduling cards into sprints (agent layer, ADR-002), the flat all-cards index
(F-020), card peek/page (F-021), container/subcard board rules (F-022), and auto-generated
sprint cadences (future ADR).

## References

ADR-001, ADR-002, ADR-003, ADR-017, ADR-018; `docs/05-VAULT_SPEC.md`;
`docs/13-DESIGN_SYSTEM.md`.
