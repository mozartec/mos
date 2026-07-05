---
id: F-036-S-03
type: story
title: In-document match highlight and scroll-to
status: Done
priority: P2
owner: mozart
parent: F-036
estimate: M
touches: [web, core]
created: 2026-07-04T10:00:00Z
updated: 2026-07-04T22:21:17Z
---

# F-036-S-03 — In-document match highlight and scroll-to

When a search result opens a file in the wiki content pane, the match should be lit
up in the rendered document and scrolled into view — not just highlighted in the
result snippet. The wiki carries `?q=` into the pane (S-02); this adds the
decoration pass to the shared markdown reader (so it works anywhere that component
renders).

## Outcome

- `MarkdownReader` gains a `highlight` input fed from `?q=`; when present, a second
  pass over the rendered DOM wraps matched terms in semantic `<mark>` and
  `scrollIntoView`s the first one.
- The pass **reuses the existing `TreeWalker` + `SKIP_TAGS` (a/code/pre/kbd/samp)**
  already in [`markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — the same DOM walk used for reference links — wrapping matches instead of
  anchors, in a second stage of the existing `effect`.
- **Term/DOM-based, never source-offset-into-HTML** (F-003-S-03): highlighting
  re-scans the rendered text nodes with the one shared folded match rule from S-01,
  so it agrees with the index and the snippet on what counts as a hit.
- `<mark>` styling meets **WCAG AA contrast** against `base-100`/`base-content` in
  **both** themes, verified by computed contrast (not screenshots).
- Clearing/leaving the query removes the marks; no marks inside code/links.

## Context — read before starting

- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — the `TreeWalker` + `SKIP_TAGS` walk and the `effect` to extend; the F-003-S-03
  note forbidding offset-into-rendered-HTML.
- [`apps/web/src/views/wiki/wiki-view.html`](../apps/web/src/views/wiki/wiki-view.html)
  — the content pane embeds `app-markdown-reader`; feed the URL `q` (S-02) to its
  new `highlight` input.
- [`packages/core`](../packages/core) — the shared match rule from S-01 (do not
  re-implement it here).
- [`apps/web/src/styles.css`](../apps/web/src/styles.css) — `<mark>` styling.
- [`apps/web/src/a11y.spec.ts`](../apps/web/src/a11y.spec.ts) — the AXE gate.

## Constraints (must honor)

- Read-only (ADR-002); reuse the one core match rule (no divergent tokenizer).
- No offset indexing into rendered HTML (term/DOM pass only).
- AA contrast for `<mark>` in both themes (computed check recorded).
- Don't break the existing reference-link decoration pass sharing the same walk.

## Plan

1. Add `highlight` input to `MarkdownReader`; parse terms via the core rule.
2. Second decoration pass in the existing `effect`: `TreeWalker` (same SKIP_TAGS)
   → wrap matches in `<mark>` → `scrollIntoView` the first.
3. Style `<mark>` for AA in both themes; add tests + AXE.

## Acceptance

- [x] Opening a doc from search highlights the matched terms in the rendered body
      and scrolls to the first match.
- [x] No highlighting inside code/pre/links; reference-link decoration still works.
- [x] `<mark>` meets AA contrast in both themes (computed value recorded); AXE
      green.
- [x] Web tests green.

## Dependencies

- **Depends on:** F-036-S-02 (`?q=` carried into the wiki content pane) and S-01
  (match rule). **Blocks:** —

## Out of scope

The result list / snippet highlighting (S-02); next/prev-match navigation within a
doc; live re-index (S-04).

## References

F-036; F-003-S-03; [`apps/web/AGENTS.md`](../apps/web/AGENTS.md).
