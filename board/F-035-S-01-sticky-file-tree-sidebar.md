---
id: F-035-S-01
type: story
title: Fixed top bar and sticky file-tree sidebar
status: Done
priority: P2
owner: mozart
parent: F-035
estimate: M
touches: [web]
created: 2026-07-04T09:00:00Z
updated: 2026-07-04T14:00:00Z
---

# F-035-S-01 — Fixed top bar and sticky file-tree sidebar

Two pieces of chrome scroll away with the body today. The app's top navigation
(Wiki | Board | Cards | Graph) is not pinned, so it disappears as you scroll any
long view. And on `/wiki` the file tree and the document are two cells of one
grid (`grid lg:grid-cols-[22rem_1fr]`) inside a single scrolling view, so reading
a long doc scrolls the tree off the top. Both come from the same root — the app
shell doesn't own the viewport height — so this story fixes the shell scroll
model once: a pinned top bar over a scrollable content region, and within
`/wiki`, a sticky tree that scrolls on its own when tall.

## Outcome

- **The top navigation bar is pinned on every view** (wiki, board, cards, graph,
  reader): it stays visible while the content region scrolls beneath it. This is
  a one-time app-shell change — a fixed/sticky header over a scrollable main —
  and must not regress the board/graph views that already manage their own height
  (`h-full` + internal overflow).
- At `lg` and up, the file-tree `<nav>` stays visible as the document scrolls —
  via `position: sticky` (or a fixed-height flex layout where each pane owns its
  scroll), within the shell's scrollable region.
- When the tree is taller than the available height it gets its own vertical
  scrollbar (`overflow-y: auto`, `max-height` bounded to the viewport); it never
  forces the page to grow.
- The content pane scrolls independently; the page does not gain a second
  scrollbar.
- Below `lg` the current stacked layout (tree above content) is unchanged.
- The tree's roving-tabindex keyboard navigation
  ([`file-tree.ts`](../apps/web/src/views/wiki/file-tree.ts)) still works, and
  focusing an off-screen tree item scrolls it into view within the tree pane,
  not the page.

## Context — read before starting

- [`apps/web/src/app/app.html`](../apps/web/src/app/app.html) — **the shell
  (primary change):** pin the top nav (fixed/sticky header) and give the view
  area a single bounded, scrollable region so the shell owns the viewport height.
  Don't regress the board/graph/cards views that already use `h-full` + internal
  `overflow`.
- [`apps/web/src/views/wiki/wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html)
  — the grid to restructure so the tree is sticky within that region.
- [`apps/web/src/views/wiki/file-tree.ts`](../apps/web/src/views/wiki/file-tree.ts)
  — keyboard nav / focus management to preserve.

## Constraints (must honor)

- Read-only (ADR-002); layout only.
- No nested-scroll keyboard trap; AXE/WCAG AA holds; focus stays visible.
- Don't regress the board / reader / graph views' scroll behavior when touching
  any shared shell container.

## Plan

1. Shell: pin the top nav (fixed/sticky header) and make the view area a bounded,
   scrollable region so the shell owns the viewport height — without regressing
   the board/graph/cards `h-full` + internal-overflow model.
2. Wiki: make the tree `<nav>` sticky (or the tree pane its own bounded scroll)
   within that region; let the content `<section>` scroll independently; no
   double page scrollbar.
3. Verify the top bar stays put on every view; `lg`+ sticky tree vs sub-`lg`
   stacked; tree keyboard nav + focus scroll-into-view.

## Acceptance

- [x] The top navigation bar stays visible on every view (wiki, board, cards,
      graph, reader) while content scrolls beneath it.
- [x] Scrolling a long doc on `/wiki` keeps the tree in view at `lg`+.
- [x] A tall tree scrolls within its own pane; the page doesn't grow a second
      scrollbar.
- [x] Sub-`lg` layout is unchanged (tree stacked above content).
- [x] Tree keyboard navigation and visible focus still work; AXE green in both
      themes.

## Dependencies

- **Depends on:** —. **Blocks:** —. Independent of S-02 / S-03.

## Out of scope

Content width and code-block overflow (S-02); Mermaid (S-03); any change to what
the tree contains or how files are discovered.

## References

F-035; [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) (a11y).
