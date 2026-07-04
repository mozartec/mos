---
id: F-035-S-02
type: story
title: Readable content width — code and tables without inner scrollbars
status: Done
priority: P1
owner: mozart
parent: F-035
estimate: S
touches: [web]
created: 2026-07-04T09:00:00Z
updated: 2026-07-04T15:00:00Z
---

# F-035-S-02 — Readable content width — code and tables without inner scrollbars

The reader wraps content in `<article class="prose max-w-prose">`
([`markdown-reader.html`](../apps/web/src/components/markdown-reader/markdown-reader.html)).
`max-w-prose` (~65ch) is right for paragraphs but too narrow for code: wide code
blocks, directory trees, and tables overflow and get their own horizontal
scrollbars, so they are cut off and unreadable. Both `/wiki` and `/reader` embed
this component, so one fix covers both.

## Outcome

- Paragraph text keeps a comfortable measure (readability), but `pre`, `table`,
  and diagram blocks use the **full content width** — they break out of the
  ~65ch text measure to the available column — so ordinary code / trees / tables
  fit without an inner horizontal scrollbar.
- The content column itself is widened (the reader is no longer a narrow strip on
  a large screen), while long paragraphs still wrap at a readable line length.
- Genuinely oversize content (a very long unbroken line) still scrolls **within
  its own block** (`overflow-x: auto` on `pre` / `table`), never the page — the
  page never scrolls horizontally.
- Applies identically on `/wiki` (embedded) and `/reader` (standalone).

## Context — read before starting

- [`apps/web/src/components/markdown-reader/markdown-reader.html`](../apps/web/src/components/markdown-reader/markdown-reader.html)
  — the `prose max-w-prose` article to rework.
- [`apps/web/src/styles.css`](../apps/web/src/styles.css) §`.prose` — add the
  width rules: a text measure for prose, full-width `pre` / `table` with
  `overflow-x: auto`.
- [`apps/web/src/views/reader/reader-view.html`](../apps/web/src/views/reader/reader-view.html)
  and [`wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html) — the
  containers whose padding / width bound the reader.

## Constraints (must honor)

- Read-only (ADR-002); CSS / layout only.
- The page must never scroll horizontally; overflow is confined to individual
  blocks.
- Dark and light both correct; AXE/WCAG AA holds.
- Keep prose line length readable — don't just remove the cap and let paragraphs
  run edge to edge.

## Plan

1. Replace the single `max-w-prose` cap with: a readable measure on flowing text,
   and full-width treatment for `pre`, `table`, and the future diagram container.
2. Add `overflow-x: auto` on `pre` / `table` as the only-when-needed fallback.
3. Verify a module directory tree and a wide flow code block from a real doc
   render without inner scrollbars at desktop width; verify no page-level
   horizontal scroll at narrow widths.

## Acceptance

- [x] A wide code block / directory tree / table renders fully without an inner
      horizontal scrollbar at desktop width, on both `/wiki` and `/reader`.
- [x] Paragraph text still wraps at a readable measure (not edge-to-edge).
- [x] The page never scrolls horizontally at any width; oversize blocks scroll
      within themselves only.
- [x] AXE green in both themes.

## Dependencies

- **Depends on:** —. **Related:** shares `markdown-reader.html` / `styles.css`
  with S-03 (Mermaid) — sequence the two; whichever lands first, the other
  rebases. **Blocks:** —

## Out of scope

Sticky sidebar (S-01); Mermaid rendering (S-03); syntax highlighting.

## References

F-035; [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md).
