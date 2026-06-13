---
id: F-023
type: feature
title: Scoped board & backlog — config-named scope
status: Done
priority: P1
phase: Phase 3
owner: mozart
dependsOn: [F-018]
touches: [core, web, docs, scripts, config]
created: 2026-06-12T18:30:00Z
updated: 2026-06-13T21:27:03Z
---

# F-023 — Scoped board & backlog — config-named scope

Today the board renders every card at once with a lone sprint `<select>` wired to a
concept the spec no longer hardcodes. After this feature the board is scoped by whatever
grouping the vault declares — a team's `sprint`, `cycle`, or `iteration`, dated or not —
with a switcher and a config-driven filter bar on top, and a separate **Backlog** view
listing what isn't scheduled into any scope. Vaults that declare no scope (this one) get
an unscoped board with the same filter bar. Supersedes F-019, which assumed a built-in
sprint.

## Outcome

- **Config (spec 0.3 → 0.4, additive —
  [ADR-020](../docs/08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)):**
  `board.scopeField` designates an enum field as the board's scope; that field's values
  are strings *or* `{ "name", "starts"?, "ends"? }` objects. Core normalizes both forms
  and resolves the *current* scope purely (dates win; fallback: last value with
  unfinished cards, then the user's last selection; the clock is a function input). A
  0.3 `sprints` key is read as a `sprint` scope field for compatibility.
- **Board scope:** when a scope field exists, the board shows one scope value at a time —
  header with the value's name, prev/next, a picker, and "n days left" when dates exist.
  No `scopeField` → unscoped board, no scope UI, and the legacy sprint `<select>` is
  gone.
- **Filter bar:** type, priority, owner, and free-text filters above the columns, built
  from the config's `fields` registry (nothing hardcoded), composable, persisted in the
  URL so a filtered board is bookmarkable (consistent with the existing deep-link
  pattern).
- **Backlog view:** a ranked list (priority, then id) of non-done cards with an empty
  scope value — reachable from the board header as the board's sibling scope. Only
  exists for scoped vaults.
- **Examples updated:** [`.mos/config.with-sprints.json`](../.mos/config.with-sprints.json)
  and [`examples/recipe-box`](../examples/recipe-box/) migrate to the 0.4 `scopeField`
  form, demonstrating the scoped configuration.

## Context — read before starting

- [ADR-020](../docs/08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)
  — the scope model; read superseded
  [ADR-017](../docs/08-DECISIONS.md#adr-017--sprints-names-with-optional-dates) and
  amended
  [ADR-018](../docs/08-DECISIONS.md#adr-018--board-scope-one-sprint-at-a-time-backlog--no-sprint)
  for the lineage (dated values, backlog ≠ the "Backlog" column).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — §config (gains `scopeField` and
  dated values; bump `specVersion` guidance to 0.4) and §6 field order.
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts)
  / `.html` — the current board + sprint filter this replaces.
- [`packages/core`](../packages/core) — where scope normalization/current-scope
  resolution live as pure functions (ADR-001).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — learns `scopeField`,
  the dated form, and the 0.3 `sprints` alias (flags malformed dates).
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — filter-bar and density
  idioms; build on F-018's tokens.

## Constraints (must honor)

- **Pure core** ([ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)):
  scope parsing/selection take plain data + a `now` argument — no `Date.now()` inside
  core, no I/O.
- **Config-driven** ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
  scope field name, values, dates, filter fields, columns — all from config.
  **Read-only** ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)):
  scheduling a card into a scope stays an agent-layer edit.
- **Backward compatible:** a 0.3 vault with string `sprints` parses and behaves as a
  `sprint`-scoped vault; a vault with no scope config gets the unscoped board; a
  dateless scope never shows a countdown.
- **Spec discipline:** [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) documents
  `scopeField`, dated values, and the 0.3 alias under the 0.4 bump in the same PR that
  ships the parser.

## Plan

1. Core: `normalizeScope(config)` → `{ field, values: { name, starts?, ends? }[] } |
   null` (reading `scopeField` or the 0.3 `sprints` alias);
   `resolveCurrentScope(scope, cards, now, lastSelection?)`; unit tests (dates,
   fallbacks, malformed input, alias).
2. Validator: accept both forms and the alias; warn on bad/overlapping dates; keep
   scope-less vaults warning-free.
3. Board header: scope switcher (picker + prev/next + days-left) when a scope field
   exists; "Backlog" as the adjacent scope; URL carries scope; remove the legacy sprint
   `<select>` for scope-less vaults.
4. Filter bar component (config-driven fields, URL-persisted state) rendered on both
   board and backlog; shared so F-020 can reuse it.
5. Backlog view: ranked list (priority then id), same card-open behavior, empty-state
   per design-system idioms.
6. Spec + [`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md) touch-ups; migrate
   [`.mos/config.with-sprints.json`](../.mos/config.with-sprints.json) and recipe-box to
   `scopeField`; `bun run validate`; specs for scope switching, fallback resolution, URL
   persistence.

## Acceptance

- [x] A vault whose scope field has dated values opens the board on the date-current
      scope and shows days remaining; prev/next and the picker switch scope; the URL
      round-trips it.
- [x] This repo's vault (no scope config) renders an unscoped board with the filter bar
      and no scope UI; the legacy sprint `<select>` is gone.
- [x] A 0.3 vault with string `sprints` still validates and renders as a
      `sprint`-scoped vault; current-scope fallback picks the last value with unfinished
      cards; no countdown shown.
- [x] Backlog lists exactly the non-done cards with an empty scope value, ranked by
      priority then id — regardless of status column — and is absent for scope-less
      vaults.
- [x] Filters (type, priority, owner, text) compose, persist in the URL, and apply on
      both board and backlog; options come from config, not code.
- [x] [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) documents `scopeField`, dated
      values, and the 0.3 alias under spec 0.4; the validator accepts all forms and
      flags malformed dates; core functions are pure and unit-tested.

## Dependencies

- **Depends on:** F-018 (build on the new tokens once). **Blocks:** F-020, F-021, F-022.
- **Supersedes:** F-019 (Dropped).

## Out of scope

Editing/scheduling cards into scopes (agent layer,
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)),
the flat all-cards index (F-020), card peek/page (F-021), container/subcard board rules
(F-022), areas and `touches` (F-024), and auto-generated cadences (future ADR).

## References

[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database),
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-020](../docs/08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md).
