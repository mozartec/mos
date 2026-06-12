---
id: F-003-S-02
type: story
title: Render markdown (GFM)
status: Done
priority: P0
owner: mozart
parent: F-003
estimate: M
dependsOn: [F-001-S-01]
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# F-003-S-02 — Render markdown (GFM)

Render a file's body to HTML with GitHub-flavored markdown: tables, fenced code, task
lists. Output is sanitized before display.

## Outcome

A reusable markdown reader component renders a file body to safe HTML with GFM support
(tables, fenced code blocks, task lists, headings, lists). This is **the** renderer — the
board card reader (F-004-S-04) reuses it, not a copy (ADR-004). Output is sanitized before
it hits the DOM.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §1 — wiki renders any markdown; the
  MVP scope (`docs/06-MVP.md`) names GFM features: tables, code, task lists.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-004 (one shared renderer).
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — pick a framework-agnostic markdown
  lib (e.g. `markdown-it` or `marked`) + a sanitizer (e.g. DOMPurify); keep the
  markdown→HTML transform itself a pure step usable from core-adjacent code.

## Constraints (must honor)

- **Sanitize**: vault markdown is untrusted; never inject unsanitized HTML.
- **Read-only**: rendering only, no edit affordances. (ADR-002)
- One renderer, reused by the board reader — design the component to take a `body` (and
  later, resolved references) as input. (ADR-004)
- Styling via Tailwind + daisyUI typography; code blocks legible with the project mono font
  once T-006 lands.

## Plan

1. Render the **body only** — frontmatter is split off by F-001-S-01, so the raw YAML block
   is never rendered. (Docs may carry `created`/`updated` frontmatter per spec `0.2`.)
2. A pure `renderMarkdown(body) -> htmlString` step (GFM plugins enabled), then sanitize.
3. An Angular component that binds the sanitized HTML and applies prose styles. Optionally
   show a small metadata line (e.g. "updated 19h ago") from `created`/`updated` when present
   — omit silently when absent.
4. Tests: a fixture exercising tables, fenced code, and task lists; a fixture with
   frontmatter (assert the YAML block is not in the output); a sanitization test
   (script/onclick stripped).

## Acceptance

- [x] Tables, fenced code, and task lists render correctly.
- [x] A file with frontmatter renders only its body; the YAML block never appears.
- [x] Output is sanitized (no active content survives).
- [x] The same component instance is used by the wiki and (later) the board card reader.

## Dependencies

- **Depends on:** F-001-S-01 (body text). **Blocks:** F-003-S-03 (links decorate this
  output), F-004-S-04 (card reader reuses it).

## Out of scope

Internal link wiring (F-003-S-03), the file tree (F-003-S-01). Markdown → safe HTML only.

## References

ADR-002, ADR-004; `docs/05-VAULT_SPEC.md` §1; `docs/06-MVP.md`; `docs/04-TECH_STACK.md`.
