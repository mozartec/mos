---
id: F-021
type: feature
title: Card page & side peek — two ways to open a card
status: Done
priority: P1
phase: Phase 3
owner: mozart
dependsOn: [F-023]
created: 2026-06-11T23:00:00Z
updated: 2026-07-02T00:04:10Z
---

# F-021 — Card page & side peek — two ways to open a card

Opening a card today means leaving the board: the click navigates to the generic file
reader. After this feature a card opens two ways — a **slide-over peek** that keeps the
board (or cards list) alive underneath, and a **dedicated card page** with structured
fields and relations. Both are deep-linkable; the reader goes back to being the wiki's
document viewer.

## Outcome

- **Card page** at a card route (id-addressed, e.g. `/card/F-004`): structured header —
  mono id, type badge, title, status/priority/owner/scope chips (config-driven fields,
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
  — current card-opening flow; the `path`/`from` params plus the originating board's
  scope + filter state it passes back (the reader has no `sprint` param — F-023 made
  scope config-named), to honor.
- [`apps/web/src/components/markdown-reader`](../apps/web/src/components/markdown-reader)
  — the renderer both surfaces reuse (id links, relative links — F-017 behavior).
- [`packages/core`](../packages/core) — references and dependency edges are already
  resolved for the graph lens, so *dependents* come from core (`deriveBlocks`), not
  view-side re-derivation; parent→**children** resolution is new here (`childrenOf`).
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

## Delivered via (stories)

Ships as three stories — the core enabler lands first, then the two web surfaces build on
it. Surfaces (`touches`) are declared per story; this container declares none of its own.

1. **F-021-S-01** — core `childrenOf` / `dependentsOf` (+ children-progress rollup), pure
   and unit-tested. The shared enabler (also what F-022's container progress reuses).
   Touches `core`.
2. **F-021-S-02** — the card-detail component (header, relations, body) and the `/card/:id`
   page route, plus the reader → card redirect and F-023 back-navigation params. Depends on
   F-021-S-01. Touches `web`.
3. **F-021-S-03** — the URL-driven side-peek host (`?peek=`) over board/backlog/cards,
   reusing the detail component, with focus trap/restore, scrim, motion, and the
   expand → page control. Depends on F-021-S-02. Touches `web`.

The Acceptance below is the feature roll-up; each story carries its own scoped acceptance.

## Acceptance

- [x] Clicking a board/backlog/cards card opens the peek over an unchanged underlying
      view; `Esc`, scrim, and back all close it; focus returns to the card.
- [x] The expand control and direct navigation both land on the card page; page and
      peeked-board URLs are shareable and render on load.
- [x] The header shows the type's configured fields; relations list parent, dependencies
      (with status), dependents, and children with a progress summary — all clickable.
- [x] Old reader links to board cards redirect to the card page; wiki docs still open in
      the reader exactly as before.
- [x] AXE passes with the peek open; focus trap/restore and reduced-motion are covered by
      specs.

## Dependencies

- **Depends on:** F-023 (board/backlog hosts; shared open behavior). **Blocks:** F-022's
  breadcrumb-chip navigation target.

## Out of scope

Editing anything (ADR-002), comments (F-008), activity/history, and container board
placement rules (F-022).

## References

ADR-001, ADR-002, ADR-003, ADR-019; `docs/13-DESIGN_SYSTEM.md`; F-017 (link behavior).
