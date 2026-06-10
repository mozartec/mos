---
id: F-004-S-03
type: story
title: Filter by sprint
status: Done
priority: P1
owner: mozart
sprint: S3
parent: F-004
estimate: S
dependsOn: [F-004-S-01, F-004-S-02]
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T00:18:00Z
---

# F-004-S-03 — Filter by sprint

A sprint selector built from `config.sprints`. Selecting one shows only its cards;
"Backlog" shows cards with no sprint.

## Outcome

`BoardView` gains a sprint selector populated from `config.sprints`, plus an "All" and a
"Backlog" option. Selecting a sprint filters the board to cards with that `sprint`; "Backlog"
shows cards with no `sprint`; "All" shows everything. Filtering is a pure projection over the
already-placed cards.

## Context — read before starting

- [`docs/06-MVP.md`](../docs/06-MVP.md) — sprint filter is in MVP scope; search beyond it is
  not.
- [`.mos/config.json`](../.mos/config.json) — `sprints: ["S1","S2","S3"]` drives the options.
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) —
  the board component to modify. It currently builds columns via `loadBoard()` and exposes
  them as `columns = signal<BoardColumn[]>([])`. The filter interposes on this signal.
- [`apps/web/src/views/board/board-view.html`](../apps/web/src/views/board/board-view.html) —
  the template where the selector goes (above the column row).
- F-004-S-02 — adds `fields: Record<string, unknown>` to `Card`, which is where `sprint`
  lives at runtime. Without S-02, there is no sprint value to filter by.

## Constraints (must honor)

- Config-driven options: build the selector from `config.sprints`, never a hardcoded list.
  (ADR-003)
- Read-only and non-destructive: filtering hides cards in the view; it never changes data.

## Plan

1. Add a `sprintFilter = signal<string | null>(null)` to `BoardView` (`null` = All).
2. Selector options: `All`, each `config.sprints` entry, `Backlog`. Render in
   [`board-view.html`](../apps/web/src/views/board/board-view.html) as a `<select>` or
   daisyUI tabs above the column row.
3. Derive the filtered card set: after `loadBoard()` builds the columns, apply the filter
   before (or after) column placement — `Backlog` = cards with empty/absent `sprint` field
   (read from `card.fields['sprint']` per S-02). Keep the derivation pure and testable.
4. Test: selecting a sprint narrows cards; adding a new sprint to config adds an option.

## Acceptance

- [x] Selecting a sprint shows only its cards; "Backlog" shows cards with no sprint.
- [x] Options come from `config.sprints`; adding a sprint in config adds an option with no
      code change.

## Dependencies

- **Depends on:** F-004-S-01, F-004-S-02. **Blocks:** —

## Out of scope

Free-text search, multi-select, date filtering. Single-sprint filter only.

## References

ADR-003; `docs/06-MVP.md`; `.mos/config.json`.
