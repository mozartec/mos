---
id: F-034-S-03
type: story
title: Board — collapsible lanes, global totals, accessibility
status: Done
priority: P2
owner: mozart
parent: F-034
estimate: M
touches: [web]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T14:30:00Z
---

# F-034-S-03 — Board: collapsible lanes, global totals, accessibility

The lane × column grid (F-034-S-02) scales and reads correctly. A many-container vault opens
as a **portfolio view** (one progress row per container, collapsed by default) and expands to
the working view; a sticky totals strip keeps the "column count = shippable leaves" reading;
and the 2-D grid meets the app's accessibility bar.

## Outcome

- **Collapsible lanes, collapsed by default.** Each lane header has a caret; collapsed shows
  only the header + progress bar. Collapse/expand state is URL-driven (e.g. an expanded-set
  param), shareable and reload-safe like `?scope=`/`?peek=`; the new key is added to
  `RESERVED_URL_KEYS` so a vault field can't hijack it.
- **Sticky global column-totals strip.** A top row shows each column's total leaf count across
  all lanes, so per-lane counts don't erode the ADR-019 "column count = shippable units"
  reading. Totals reflect the active scope + filters.
- **Accessibility (AXE / WCAG AA).** Lane headers are labelled regions with `aria-expanded` on
  the collapse control; keyboard traversal works across the lane × column grid; horizontal
  scroll is confined to the grid, never the page body; focus order is sensible.

## Context — read before starting

- [`apps/web/src/views/board/board-view.ts`](../apps/web/src/views/board/board-view.ts) /
  [`.html`](../apps/web/src/views/board/board-view.html) — the lane grid from F-034-S-02 and
  `RESERVED_URL_KEYS`; the `?scope=`/`?peek=` URL-merge helpers are the pattern for the
  collapse param.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — the mandatory AXE / WCAG AA requirements,
  signals, and `host`/control-flow idioms.
- [`apps/web/src/a11y.spec.ts`](../apps/web/src/a11y.spec.ts) — where the AXE assertions live.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — sticky-header, chip, and density
  idioms.

## Constraints (must honor)

- **Read-only (ADR-002):** collapse is view state, persisted only in the URL — no writes.
- **Presentational only:** totals and collapse never change placement or grouping; they read the
  same lanes core returns.
- **Zero-config unaffected:** a flat (no-`laneField`) board shows no lane chrome, no collapse,
  no per-lane split — the totals strip degenerates to the plain column counts it shows today.
- **A11y is a gate, not a follow-up:** AXE must pass with lanes collapsed and expanded.

## Plan

1. Add per-lane collapse with a URL-backed expanded set (default collapsed); reserve the key.
2. Add the sticky global column-totals strip above the lanes.
3. A11y: regions/labels, `aria-expanded`, keyboard traversal, grid-confined horizontal scroll.
4. Specs: collapse round-trips through the URL, default is collapsed, totals are correct under
   scope+filter, and `a11y.spec.ts` is green with lanes both collapsed and expanded.

## Acceptance

- [x] Lanes are collapsible and **collapsed by default**; state round-trips through the URL and
      survives reload; the collapse key is reserved.
- [x] The sticky global column-totals strip shows correct totals under the active scope+filters;
      a flat board shows today's plain counts.
- [x] AXE passes (WCAG AA) with lanes collapsed and expanded; keyboard traversal works; only the
      grid scrolls horizontally, never the page.
- [x] Board + a11y specs green; flat vault unchanged.

## Dependencies

- **Depends on:** [F-034-S-02](F-034-S-02-board-lanes-render.md) (the lane grid it enhances;
  both edit the board view, so they must run in sequence, not parallel). **Blocks:** —

## Out of scope

Core grouping (F-034-S-01); making containers visible / the type-facet fix (F-034-S-02); docs +
the ADR amendment (F-034-S-04); arbitrary-enum lane modes (F-034 Out of scope).

## References

F-034, F-034-S-02; [`apps/web/AGENTS.md`](../apps/web/AGENTS.md);
[`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md); [ADR-002](../docs/08-DECISIONS.md),
[ADR-019](../docs/08-DECISIONS.md).
