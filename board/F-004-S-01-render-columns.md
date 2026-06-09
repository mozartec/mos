---
id: F-004-S-01
type: story
title: Render columns from config
status: Todo
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T10:00:00Z
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
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) — the
  current stub: it only calls `listFiles()` and holds raw path strings. **There is no model
  yet — you build it here.**
- [`apps/web/src/views/wiki/wiki-view.ts`](../apps/web/src/views/wiki/wiki-view.ts)
  `loadFiles()` — copy this load pattern: `Promise.all([readFile('.mos/config.json'),
  listFiles()])`, then `loadConfig(configText)`, then `readFile` + `parseFile` each path.
- [`packages/core/src/index.ts`](../packages/core/src/index.ts) — the exports you compose:
  `loadConfig`, `parseFile`, `buildModel`, `placeCard`, `sortWithinColumn`.
- F-002-S-02 (`placeCard`/`sortWithinColumn`) and F-001-S-02 (`buildModel`) — the inputs.

## Constraints (must honor)

- Config-driven: column set and order come from config, never hardcoded. (ADR-003)
- Read-only: render only; no drag targets, no move handlers. (ADR-002)
- Use the core placement/sort helpers — don't re-implement mapping in the component.
- `placeCard` **throws** on an unrecognized type/status — never let one bad card crash the
  board; isolate the call per card (try/catch, skip + `console.error`).

## Plan

1. In `BoardView`, load like `WikiView.loadFiles()`: read `.mos/config.json` + `listFiles()`,
   `loadConfig(configText)`, then `readFile` each path and `parseFile(path, text)`.
2. `buildModel(parsedFiles, config)` → `VaultModel`; iterate `Object.values(model.cards)`.
3. For each card call `placeCard(card, config)` (guarded — see Constraints); drop
   `column: null` (hidden states). Group into `{ column -> Card[] }` over
   `config.board.columns` order.
4. Sort each column with `sortWithinColumn(cards, config)` (priority then id).
5. Replace `board-view.html` to render the columns with daisyUI. Render at least each card's
   id/title for now (the real card face is F-004-S-02; if it has landed, host `<app-card>`).
   Hold results in signals; no mutable board state.

## Acceptance

- [ ] The board builds its model from the source (load → `parseFile` → `buildModel`), not a
      hardcoded list, and an unplaceable card is skipped without crashing the board.
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
