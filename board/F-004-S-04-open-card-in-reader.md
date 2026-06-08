---
id: F-004-S-04
type: story
title: Open a card in the wiki reader
status: Todo
priority: P1
owner: mozart
sprint: S3
parent: F-004
estimate: S
---

# F-004-S-04 — Open a card in the wiki reader

Clicking a card opens its file in the F-003 reader (same renderer), with a way back to the
board.

## Outcome

Clicking a board card opens its source file in the same markdown reader the wiki uses
(F-003-S-02), with internal links live (F-003-S-03) and a clear way back to the board. One
renderer, two entry points (ADR-004) — no duplicate reading surface.

## Context — read before starting

- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-004 (board and wiki share one
  renderer; clicking a card opens it in the reader).
- F-004-S-02 — the card's `select` event is the trigger.
- F-003-S-02/S-03 — the renderer + clickable links being reused.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — routing/toggling
  between views.

## Constraints (must honor)

- Reuse the F-003 reader component; do not fork a board-specific renderer. (ADR-004)
- Read-only: opening a card shows it; no edit affordance. (ADR-002)
- Preserve board context so "back" returns to the same filtered board state.

## Plan

1. On a card `select`, route/navigate to the reader for that card's path (reuse the wiki
   reader component, not a copy).
2. Provide a back control that returns to the board with its prior sprint filter intact.
3. Ensure internal links inside the opened card work (F-003-S-03 behavior).

## Acceptance

- [ ] Clicking a card opens its file in the F-003 reader (same renderer).
- [ ] There's a clear way back to the board, preserving the sprint filter.
- [ ] Internal links inside the card are clickable.

## Dependencies

- **Depends on:** F-004-S-02, F-003-S-02, F-003-S-03. **Blocks:** —

## Out of scope

Editing the card, a side-by-side split view, comments. Open-in-reader + back only.

## References

ADR-002, ADR-004; `docs/03-ARCHITECTURE.md`.
