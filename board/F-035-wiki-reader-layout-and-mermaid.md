---
id: F-035
type: feature
title: Wiki reader — sticky tree, readable width, Mermaid diagrams
status: Draft
priority: P2
phase: Phase 4
owner: mozart
touches: [web, docs]
created: 2026-07-04T09:00:00Z
updated: 2026-07-04T09:00:00Z
---

# F-035 — Wiki reader — sticky tree, readable width, Mermaid diagrams

The wiki lens (`/wiki`) and the standalone reader (`/reader`) render a vault's
markdown through `marked` + `DOMPurify`, but three things make long or
code-heavy docs hard to read:

1. **The top bar and the file-tree sidebar scroll away with the body.** The app's
   top navigation (Wiki | Board | Cards | Graph) isn't pinned, and on `/wiki` the
   tree and the document are two cells of one grid inside a single scrolling view
   — so scrolling a long document scrolls both the nav and the tree off the top.
   You lose the lens switcher and your place in the tree while reading.
2. **The content column is capped at `max-w-prose` (~65ch).** That measure is
   right for paragraphs but strangles wide content: code blocks, directory
   trees, and tables overflow the column and get their own horizontal
   scrollbars, so they are cut off and unreadable at any screen size.
3. **Mermaid diagrams render as raw code.** A fenced ` ```mermaid ` block comes
   out as a `<pre><code class="language-mermaid">` dump because the pipeline has
   no diagram renderer — even though this project's own conventions tell authors
   to diagram with Mermaid (`AGENTS.md` §Code & workflow conventions).

This feature makes the reader pleasant for real docs: a sticky, independently
scrolling tree; a reading column where code and tables fit without inner
scrollbars; and Mermaid fenced blocks rendered as themed diagrams.

## Outcome

- **Fixed top bar:** the top navigation stays pinned on every view; only the
  content region scrolls, so the lens switcher is always reachable.
- **Sticky file tree (`/wiki`):** the tree stays in place while the document
  scrolls, and gains its own scrollbar when it is taller than the viewport.
- **Readable width:** prose keeps a comfortable line length, but code blocks,
  directory trees, and tables use the full content width and no longer need
  inner horizontal scrollbars for ordinary content; the *page* never scrolls
  sideways.
- **Mermaid diagrams:** ` ```mermaid ` fenced blocks render as inline SVG,
  themed to the active light/dark theme, with a graceful fallback to the
  original source (plus an error note) when a diagram fails to parse.
- **No new bundle cost by default:** the Mermaid engine is lazy-loaded only when
  a rendered page actually contains a diagram, so the board and wiki initial
  loads are unchanged.
- **Read-only, config-free, accessible:** no writes (ADR-002); nothing to
  configure; AXE/WCAG AA holds; pure `core` is untouched (this is all
  `apps/web`).

## Context — read before starting

- [`apps/web/src/views/wiki/wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html)
  — the `grid lg:grid-cols-[22rem_1fr]` layout whose tree cell scrolls with the
  body (S-01).
- [`apps/web/src/views/wiki/file-tree.ts`](../apps/web/src/views/wiki/file-tree.ts)
  — the tree's roving-tabindex keyboard behavior that must survive the layout
  change.
- [`apps/web/src/app/app.html`](../apps/web/src/app/app.html) — the app shell and
  its scroll container; the sticky / independent-scroll change has to reckon with
  where the scroll actually lives.
- [`apps/web/src/components/markdown-reader/markdown-reader.html`](../apps/web/src/components/markdown-reader/markdown-reader.html)
  — `<article class="prose max-w-prose">`, the width cap (S-02).
- [`apps/web/src/components/markdown-reader/render-markdown.ts`](../apps/web/src/components/markdown-reader/render-markdown.ts)
  — the `marked` + `DOMPurify` pipeline; the Mermaid hook lands after render
  (S-03).
- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — where rendered HTML is placed into the container (the post-render step for
  Mermaid).
- [`apps/web/src/views/reader/reader-view.html`](../apps/web/src/views/reader/reader-view.html)
  — the standalone `/reader` page; it embeds the same `app-markdown-reader`, so
  S-02/S-03 fix both surfaces at once.
- [`apps/web/src/styles.css`](../apps/web/src/styles.css) §`.prose` — prose,
  code, and link styling to extend for width and diagram containers.
- [`apps/web/src/services/theme-service.ts`](../apps/web/src/services/theme-service.ts)
  — the light/dark signal Mermaid re-themes against.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — prose/reader idioms;
  [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — where the new `mermaid`
  dependency is recorded.

## Constraints (must honor)

- **Read-only (ADR-002).** Rendering and layout only; no vault writes.
- **Untrusted vault content.** Markdown stays sanitized; Mermaid runs with
  `securityLevel: 'strict'` and its SVG is inserted without reopening an XSS hole
  (DOMPurify still guards the surrounding HTML).
- **Lazy-load the diagram engine.** `mermaid` is large; import it dynamically
  only when a page contains a diagram, per the app's lazy-loading rule
  (`apps/web/AGENTS.md`). It must never enter the board/wiki initial chunk.
- **Accessibility (AXE/WCAG AA).** Tree keyboard nav intact; no nested-scroll
  keyboard traps; diagrams carry an accessible name and a text fallback; contrast
  holds in both themes.
- **Pure core untouched (ADR-001).** No `packages/core` changes.
- **The page never scrolls horizontally.** Overflow is confined to individual
  blocks, and only when content genuinely exceeds the (now wider) column.

## Plan

Three stories (all `web`; S-02 and S-03 lightly share `markdown-reader` /
`styles.css` — sequence those two; S-01 is independent):

1. **S-01 — Fixed top bar + sticky file-tree sidebar** — pin the app chrome (top
   nav on every view; the `/wiki` tree) via one app-shell scroll-model change.
2. **S-02 — Readable content width** so code blocks, trees, and tables fit
   without inner scrollbars, on both `/wiki` and `/reader`.
3. **S-03 — Mermaid diagrams**, lazy-loaded, themed, with a safe fallback.

## Acceptance

- [ ] The top navigation bar stays visible on every view (wiki, board, cards,
      graph, reader) while content scrolls beneath it.
- [ ] On `/wiki`, scrolling a long document keeps the file tree in view; a tree
      taller than the viewport scrolls on its own; the content scrolls
      independently; below `lg` the current stacked layout is preserved.
- [ ] A wide code block / directory tree / table renders fully in the reader
      without an inner horizontal scrollbar for ordinary content, on both
      `/wiki` and `/reader`; the page itself never scrolls sideways.
- [ ] A ` ```mermaid ` block renders as an SVG diagram matching the active theme;
      a malformed diagram falls back to its source plus an error note without
      breaking the rest of the page; ordinary code blocks are unaffected.
- [ ] `mermaid` is dynamically imported — the board and wiki initial bundles do
      not grow (verify it is a lazy chunk).
- [ ] AXE passes on the wiki and reader in both themes; tree keyboard navigation
      still works.
- [ ] `bun run lint && bun run test && bun run build` are green;
      `docs/04-TECH_STACK.md` records the `mermaid` dependency.

## Dependencies

- **Depends on:** — (the wiki and reader lenses already exist). **Blocks:** —

## Out of scope

- Syntax highlighting of non-Mermaid code blocks (a separate enhancement).
- Non-Mermaid diagram languages (PlantUML, Graphviz, etc.).
- Any editing of vault content, and any server/CLI change — this is `apps/web`
  rendering only.
- A configurable reading width or a separate diagram theme picker (Mermaid
  follows the existing app theme).

## References

ADR-001, ADR-002; [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) (lazy loading,
a11y); `marked`, `dompurify`, `mermaid`;
[`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md),
[`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md).
