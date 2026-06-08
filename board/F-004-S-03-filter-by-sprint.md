---
id: F-004-S-03
type: story
title: Filter by sprint
status: Todo
priority: P1
owner: mozart
sprint: S3
parent: F-004
estimate: S
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
- F-004-S-01 — the placed columns this filter narrows.

## Constraints (must honor)

- Config-driven options: build the selector from `config.sprints`, never a hardcoded list.
  (ADR-003)
- Read-only and non-destructive: filtering hides cards in the view; it never changes data.

## Plan

1. Selector options: `All`, each `config.sprints` entry, `Backlog`.
2. Hold the selection in a signal; derive the filtered card set before column placement (or
   filter the placed set) — keep it pure and testable.
3. `Backlog` = cards with empty/absent `sprint`.

## Acceptance

- [ ] Selecting a sprint shows only its cards; "Backlog" shows cards with no sprint.
- [ ] Options come from `config.sprints`; adding a sprint in config adds an option with no
      code change.

## Dependencies

- **Depends on:** F-004-S-01. **Blocks:** —

## Out of scope

Free-text search, multi-select, date filtering. Single-sprint filter only.

## References

ADR-003; `docs/06-MVP.md`; `.mos/config.json`.
