---
id: F-035-S-03
type: story
title: Render Mermaid fenced blocks as diagrams (lazy-loaded, themed)
status: Todo
priority: P2
owner: mozart
parent: F-035
estimate: M
touches: [web, docs]
created: 2026-07-04T09:00:00Z
updated: 2026-07-04T09:00:00Z
---

# F-035-S-03 — Render Mermaid fenced blocks as diagrams (lazy-loaded, themed)

The pipeline (`marked` + `DOMPurify`,
[`render-markdown.ts`](../apps/web/src/components/markdown-reader/render-markdown.ts))
has no diagram renderer, so a fenced ` ```mermaid ` block renders as a
`<pre><code class="language-mermaid">` code dump. This project's own conventions
tell authors to diagram with Mermaid (`AGENTS.md`), so the reader should render
those blocks as diagrams.

## Outcome

- After markdown render, each `code.language-mermaid` block is replaced by an
  inline SVG diagram produced by **`mermaid`** (MIT; the reference
  implementation; actively maintained).
- **Lazy-loaded:** `mermaid` is imported dynamically (`await import('mermaid')`)
  only when a rendered page actually contains a diagram — it must be a separate
  chunk, never in the board / wiki initial bundle.
- **Themed:** diagrams use Mermaid's `dark` / `default` theme wired to the app's
  theme signal ([`theme-service.ts`](../apps/web/src/services/theme-service.ts))
  and re-render on theme switch.
- **Safe:** rendered with `securityLevel: 'strict'` (untrusted vault content); a
  block that fails to parse falls back to its original source plus a small error
  note, and never throws out of the reader or breaks sibling content.
- Ordinary (non-Mermaid) code blocks are completely unaffected.
- The diagram container fits the wider content column (S-02) and scrolls
  gracefully if a diagram is very large.

## Context — read before starting

- [`apps/web/src/components/markdown-reader/render-markdown.ts`](../apps/web/src/components/markdown-reader/render-markdown.ts)
  — the render step; Mermaid runs *after* sanitize, on the produced nodes.
- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — where HTML is inserted into `#container`; the post-render Mermaid pass and
  its re-run on theme change live here (or in a small dedicated helper).
- [`apps/web/src/services/theme-service.ts`](../apps/web/src/services/theme-service.ts)
  — the light / dark signal to map to Mermaid's theme.
- [`apps/web/package.json`](../apps/web/package.json) — add `mermaid`.
- [`apps/web/AGENTS.md`](../apps/web/AGENTS.md) — lazy loading + a11y rules;
  [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — record the dependency.

## Constraints (must honor)

- Read-only (ADR-002); pure `core` untouched (ADR-001).
- **Lazy chunk only** — verify `mermaid` does not enter the initial bundle.
- Untrusted content: `securityLevel: 'strict'`; do not reintroduce an XSS path
  when inserting the SVG (Mermaid sanitizes; keep DOMPurify on the surrounding
  HTML).
- Accessible: each diagram gets an accessible name (Mermaid `accTitle` / aria)
  and the source remains available as a fallback; AXE/WCAG AA in both themes.
- Failure is contained: a bad diagram degrades to code + note, never a blank
  page or a thrown error.
- Deterministic render ids (derive from the block's index, not a wall-clock /
  random source that breaks tests and offends the no-`Date.now`/`Math.random`
  conventions).

## Plan

1. Add `mermaid` to `apps/web`. In a small post-render helper: find
   `code.language-mermaid` nodes; if any exist, `await import('mermaid')`, init
   with the theme + strict security, and render each to SVG.
2. Wire re-render to the theme signal so diagrams follow light / dark.
3. Wrap each render in try/catch → fallback to the original `<pre>` + an error
   note.
4. Tests: a mermaid block yields an `<svg>`; a malformed block yields code +
   error and does not throw; a non-mermaid code block is untouched; the initial
   bundle does not include `mermaid` (lazy-chunk assertion or build inspection).
5. Record `mermaid` in `docs/04-TECH_STACK.md`.

## Acceptance

- [ ] A ` ```mermaid ` block renders as an SVG diagram in the reader (both
      `/wiki` and `/reader`).
- [ ] The diagram matches the active theme and updates on theme switch.
- [ ] `mermaid` is a lazy chunk — the board and wiki initial bundles don't grow.
- [ ] A malformed diagram falls back to source + error note without breaking the
      page; ordinary code blocks are unaffected.
- [ ] AXE green in both themes; `docs/04-TECH_STACK.md` lists `mermaid`.
- [ ] `bun run lint && bun run test && bun run build` green.

## Dependencies

- **Depends on:** —. **Related:** shares `markdown-reader` / `styles.css` with
  S-02 — sequence the two. **Blocks:** —

## Out of scope

Non-Mermaid diagram languages; syntax highlighting; a diagram zoom / pan UI;
export / download of diagrams.

## References

F-035; `mermaid` (MIT); [`apps/web/AGENTS.md`](../apps/web/AGENTS.md);
[`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md).
