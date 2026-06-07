---
id: F-004-S-01
type: story
title: Render columns from config
status: Todo
priority: P0
owner: mozart
sprint: S2
parent: F-004
estimate: M
---

# F-004-S-01 — Render columns from config

Lay out the board's columns in `config.columns` order and place each visible card in its
computed column, sorted by `sortWithinColumn` (priority then id).

## Outcome

`BoardView` renders one column per entry in `config.board.columns`, in order, and places
each visible card in the column computed by F-002-S-02. Within a column, cards sort by
`config.board.sortWithinColumn` (priority rank, then id). Hidden-state cards never appear.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5–§6 — columns config, state→column
  mapping, hidden states.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) lines 111–134 — the exact
  placement + sort + hidden-lane behavior to mirror.
- F-002-S-02 (`placeCard`/sort helpers) and F-001-S-02 (the cards) — the inputs.

## Constraints (must honor)

- Config-driven: column set and order come from config, never hardcoded. (ADR-003)
- Read-only: render only; no drag targets, no move handlers. (ADR-002)
- Use the core placement/sort helpers — don't re-implement mapping in the component.

## Plan

1. From the model + config, group cards into `{ column -> card[] }` via the F-002-S-02
   helper; drop `column: null`.
2. Sort each column with the core sort helper (priority then id).
3. Render columns with daisyUI; each hosts the card component (F-004-S-02). Track nothing
   mutable beyond view state (signals).

## Acceptance

- [ ] Columns appear in config order; each visible card is in its computed column.
- [ ] Cards within a column are ordered by priority then id.
- [ ] Hidden-state cards (`Deferred`/`Dropped`) are absent.

## Dependencies

- **Depends on:** F-002-S-02, F-001-S-02. **Blocks:** —

## Out of scope

The card face (F-004-S-02), sprint filter (F-004-S-03), opening cards (F-004-S-04). Column
layout + placement only.

## References

ADR-002, ADR-003; `docs/05-VAULT_SPEC.md` §5–§6; `scripts/validate-vault.mjs`.
