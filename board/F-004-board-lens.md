---
id: F-004
type: feature
title: Board lens
status: Done
priority: P0
phase: MVP
owner: mozart
dependsOn: [F-001, F-002, T-002]
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# F-004 — Board lens

The Kanban view: columns from config, cards grouped by their type's state→column mapping,
filterable by sprint, with hidden states kept off the board and a badge for Blocked.

## Outcome

After this feature, `apps/web` has a working `BoardView` — the MVP's centerpiece. It renders
columns in `config.board.columns` order, places each visible card in the column its type's
state mapping computes (F-002-S-02), sorts within a column by priority then id, shows the
fields each type declares, badges `Blocked` cards, keeps `Deferred`/`Dropped` off the board,
filters by sprint, and opens a card in the wiki reader. Opening this very repo as a vault
reproduces the board the interim validator prints (MVP acceptance #1).

## Context — read before starting

- [`docs/06-MVP.md`](../docs/06-MVP.md) — the board is "the one screen that matters"; this
  feature is the bulk of the MVP definition of done.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5 — states→columns, hidden states,
  `Blocked` badge; §4 for the fields a card face shows.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) lines 111–139 — the reference
  layout (column placement + sort + hidden lane) this view must match visually.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — `BoardView` in
  `views/board/`; the card face becomes a reusable `components/` piece.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002 (read-only: no drag/move/edit),
  ADR-003 (config-driven), ADR-004 (clicking a card opens the shared reader).
- F-001/F-002 (model + placement) and T-002 (real files).

## Constraints (must honor)

- **Read-only**: no drag-and-drop, no move/assign/edit — those are writes deferred past the
  MVP. (ADR-002, `docs/06-MVP.md`)
- **Config-driven**: columns, mapping, and card fields come from config; nothing hardcoded.
  (ADR-003)
- Reuse the F-003 markdown renderer for the card reader — don't fork it. (ADR-004)
- Standalone components + signals; external templates per `apps/web` conventions.

## Plan

Stories in order: render columns + placement (S-01), the card face (S-02), sprint filter
(S-03), open-in-reader (S-04). Drive everything from the core model so the view stays a thin
projection.

## Acceptance

- [x] Columns render in config order; visible cards land in the right column, sorted by
      priority then id.
- [x] `Deferred`/`Dropped` are off the board; `Blocked` shows in In Progress with a badge.
- [x] Card faces show their type's configured fields; sprint filter works.
- [x] Clicking a card opens its file in the F-003 reader with a way back.
- [x] Opening this repo as a vault matches `validate-vault.mjs`'s board layout.

## Stories

F-004-S-01, F-004-S-02, F-004-S-03, F-004-S-04

## Dependencies

- **Depends on:** F-001, F-002 (model + placement), F-003-S-02/03 (shared reader for S-04),
  T-002 (real files); icon/font polish from T-006.
- **Blocks:** the MVP completing (with F-005).

## Out of scope

Any write (drag, manual ordering, move, assign), comments, dependency graphs, search beyond
the sprint filter. Read-only Kanban only.

## References

ADR-002, ADR-003, ADR-004; `docs/06-MVP.md`, `docs/05-VAULT_SPEC.md`,
`scripts/validate-vault.mjs`.
