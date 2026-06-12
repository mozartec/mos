---
id: F-021
type: feature
title: Card page & side peek — two ways to open a card
status: Draft
priority: P1
phase: Phase 3
owner: mozart
dependsOn: [F-023]
touches: [core, web]
created: 2026-06-11T23:00:00Z
updated: 2026-06-12T20:08:00Z
---

# F-021 — Card page & side peek — two ways to open a card

Opening a card today means leaving the board: the click navigates to the generic file
reader. After this feature a card opens two ways — a **slide-over peek** that keeps the
board (or cards list) alive underneath, and a **dedicated card page** with structured
fields and relations. Both are deep-linkable; the reader goes back to being the wiki's
document viewer.

## Outcome

- **Card page** at a card route (id-addressed, e.g. `/card/F-004`): structured header —
  mono id, type badge, title, status/priority/owner/sprint chips (config-driven fields,
  as on board cards) — then **relations** (parent breadcrumb, `dependsOn` with each
  dependency's status, *dependents* computed from the reverse edges, children with a
  done-progress summary) — then the rendered markdown body.
- **Side peek:** clicking a card on the board, backlog, or cards lens slides the same
  content in from the right over a scrim; the underlying view keeps its scroll, scope,
  and filters. `Esc`, scrim click, or browser back closes it; an expand control goes to
  the full page. The peek state lives in the URL (e.g. `?peek=F-004`), so a peeked board
  is shareable.
- Relations are clickable: ids navigate within the peek (or page), keeping a sensible
  back-trail.
- The wiki/reader flow for plain docs is untouched; board-card deep links that used the
  reader redirect to the card page.

## Context — read before starting

- ADR-019 in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — children/progress
  presentation on the detail surfaces.
- [`apps/web/src/views/reader/reader-view.ts`](../apps/web/src/views/reader/reader-view.ts)
  — current card-opening flow, `from`/`sprint` back-navigation params to honor.
- [`apps/web/src/components/markdown-reader`](../apps/web/src/components/markdown-reader)
  — the renderer both surfaces reuse (id links, relative links — F-017 behavior).
- [`packages/core`](../packages/core) — references/edges already resolved for the graph
  lens; dependents/children come from there, not view-side re-derivation.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — peek motion (240ms in /
  180ms out, reduced-motion collapse), elevation, chip idioms.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — a11y bar (focus trap and restore are
  the hard part here).

## Constraints (must honor)

- **Read-only** (ADR-002): the page/peek render state; no write affordances.
- **Pure core** (ADR-001): relation lookups (children, dependents) are core functions
  over the vault model.
- **Config-driven** (ADR-003): header fields per the card's type definition; works for
  recipe-box types unchanged.
- **A11y:** peek is a proper dialog — focus trapped, `Esc` closes, focus returns to the
  triggering card, `aria-modal`, reduced-motion honored.
- **URLs are contracts** (ADR-004 spirit): page and peek are both bookmarkable; existing
  reader deep links to cards keep working via redirect.

## Plan

1. Core: `childrenOf(id)`, `dependentsOf(id)` (+ progress rollup) with tests, if not
   already exposed for the graph.
2. Card-detail component (header, relations, body) shared by page and peek.
3. Card route + redirect from reader-with-card-path; back-navigation params honored.
4. Peek host on board/backlog/cards: URL-driven (`?peek=`), CDK overlay (or dialog
   element), scrim, focus management, motion per design system.
5. Specs: open/close/expand/back flows, focus restore, deep links (page + peek), redirect,
   recipe-box fixture render.

## Acceptance

- [ ] Clicking a board/backlog/cards card opens the peek over an unchanged underlying
      view; `Esc`, scrim, and back all close it; focus returns to the card.
- [ ] The expand control and direct navigation both land on the card page; page and
      peeked-board URLs are shareable and render on load.
- [ ] The header shows the type's configured fields; relations list parent, dependencies
      (with status), dependents, and children with a progress summary — all clickable.
- [ ] Old reader links to board cards redirect to the card page; wiki docs still open in
      the reader exactly as before.
- [ ] AXE passes with the peek open; focus trap/restore and reduced-motion are covered by
      specs.

## Dependencies

- **Depends on:** F-019 (board/backlog hosts; shared open behavior). **Blocks:** F-022's
  breadcrumb-chip navigation target.

## Out of scope

Editing anything (ADR-002), comments (F-008), activity/history, and container board
placement rules (F-022).

## References

ADR-001, ADR-002, ADR-003, ADR-019; `docs/13-DESIGN_SYSTEM.md`; F-017 (link behavior).
