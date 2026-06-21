---
id: F-021-S-03
type: story
title: Side peek — URL-driven overlay, focus management, motion
status: Todo
priority: P1
owner: mozart
parent: F-021
estimate: M
dependsOn: [F-021-S-02, F-023]
touches: [web]
created: 2026-06-21T09:31:58Z
updated: 2026-06-21T09:31:58Z
---

# F-021-S-03 — Side peek: URL-driven overlay, focus management, motion

The card page (F-021-S-02) makes you leave the current view. This story adds the **slide-over
peek**: clicking a card on the board, backlog, or cards lens slides the same card-detail
content in from the right over a scrim, keeping the underlying view's scroll, scope, and
filters alive. The peek state lives in the URL, so a peeked board is shareable.

## Outcome

- Clicking a card on the board, backlog, or cards lens opens a **peek** hosting the
  F-021-S-02 card-detail component over a scrim; the underlying view keeps its scroll,
  scope, and filters.
- **Peek state lives in the URL** (e.g. `?peek=F-004`), so a peeked view is bookmarkable and
  shareable and renders on load.
- `Esc`, scrim click, and browser back all close it; an **expand control** navigates to the
  full card page (F-021-S-02). Focus returns to the triggering card on close.
- The peek is a proper dialog: focus trapped, `aria-modal`, reduced-motion honored; motion
  per the design system (240ms in / 180ms out, reduced-motion collapse).

## Context — read before starting

- Parent feature F-021 — the peek/page duality and the shared Acceptance.
- F-021-S-02 — the card-detail component this hosts (built standalone there) and the expand
  target (the card page).
- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) and
  the backlog / cards-lens hosts (F-023) — where the peek is mounted and the card click is
  intercepted.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — peek motion (240ms in / 180ms
  out, reduced-motion collapse), elevation, scrim.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — the a11y bar; the focus trap and restore
  are the hard part here, and AXE must pass with the peek open.
- [ADR-004](../docs/08-DECISIONS.md#adr-004) (bookmarkable views) — the peek is URL-driven,
  not transient component state.

## Constraints (must honor)

- **Read-only (ADR-002):** the peek renders state; no write affordances.
- **A11y:** a proper dialog — focus trapped, `Esc` closes, focus returns to the triggering
  card, `aria-modal`, reduced-motion honored; AXE passes with the peek open.
- **URL-driven:** the peek is `?peek=`, so back/forward and deep links work; opening a peek
  does not lose the underlying view's scope/filters/scroll.
- **Reuse, don't fork:** host the F-021-S-02 detail component — no second copy of the header
  or relations.

## Plan

1. Peek host (CDK overlay or dialog element) on board/backlog/cards, URL-driven via
   `?peek=`, with a scrim; intercept the card click to set the peek param instead of
   navigating.
2. Focus management: trap focus in the peek, restore to the triggering card on close, wire
   `Esc` / scrim / browser-back to close; reduced-motion-aware motion per the design system.
3. The expand control navigates to the F-021-S-02 card page.
4. Specs: open/close/expand/back flows, focus restore, peeked-URL deep link renders on load,
   underlying view keeps scope/filters/scroll, AXE with the peek open.

## Acceptance

- [ ] Clicking a board/backlog/cards card opens the peek over an unchanged underlying view;
      `Esc`, scrim, and browser back all close it; focus returns to the card.
- [ ] The peek state is in the URL (`?peek=`); a peeked-view URL is shareable and renders on
      load; the expand control lands on the card page.
- [ ] AXE passes with the peek open; focus trap/restore and reduced-motion are covered by
      specs.

## Dependencies

- **Depends on:** F-021-S-02 (the detail component + expand target), F-023 (board/backlog
  hosts). **Blocks:** F-022's breadcrumb-chip navigation target (the chip opens the peek).

## Out of scope

The card-detail component itself and the page route (F-021-S-02); container board placement
(F-022); any editing (ADR-002).

## References

F-021; F-021-S-02; F-023; [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md);
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-004](../docs/08-DECISIONS.md#adr-004).
