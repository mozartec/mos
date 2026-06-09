---
id: F-003-S-03
type: story
title: Clickable internal links
status: In Progress
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T14:35:00Z
priority: P0
owner: mozart
sprint: S2
parent: F-003
estimate: M
---

# F-003-S-03 — Clickable internal links

Turn resolved references (F-001-S-03) into in-app links; clicking navigates the reader to
the target file. Uses event delegation over the rendered HTML.

## Outcome

References resolved by core (F-001-S-03) become clickable in the rendered reader: clicking
`see F-002`, `[[F-002]]`, or a markdown link to a card navigates the wiki to that file
without a full page load. Unresolved ids render as plain (non-link) text, visibly distinct.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §7 — the reference forms and "resolve
  by id, survive renames."
- [`packages/core/src/references.ts`](../packages/core/src/references.ts) —
  `resolveReferences(body, model, config): Reference[]`, each `{ id, target?, unresolved }`.
  This is the **authoritative** resolution (handles docs too). Note its `start`/`end` index
  the **raw markdown**.
- [`apps/web/src/components/markdown-reader/render-markdown.ts`](../apps/web/src/components/markdown-reader/render-markdown.ts)
  — the pipeline is markdown → HTML → **`DOMPurify.sanitize`**. Those raw-markdown offsets
  **do not survive** this transform — decorate the rendered DOM, never index HTML by offset.
- [`apps/web/src/components/markdown-reader/markdown-reader.ts`](../apps/web/src/components/markdown-reader/markdown-reader.ts)
  — currently takes only `body` and binds `[innerHTML]`; you add `model`/`config` inputs and
  a `navigate` output.
- [`apps/web/src/views/wiki/wiki-view.ts`](../apps/web/src/views/wiki/wiki-view.ts) —
  `select(path)` is the navigation target; it already loads a path. You also build the
  `VaultModel` here (it isn't built yet) to feed the reader.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002 (navigation only; no writes).

## Constraints (must honor)

- Read-only navigation; clicking opens the target in the reader, never edits.
- Use **event delegation** over the rendered container (one listener), not per-link
  handlers, so it scales with document size.
- Core owns **resolution**: which ids resolve and to what path comes from `resolveReferences`,
  never decided in the component. The component only **locates** id occurrences in the
  rendered text (re-scanning with `config.references.idPattern`) to attach the decoration,
  because source offsets don't survive rendering.
- Decorate the DOM **after** `DOMPurify.sanitize` (wrap matched text via DOM APIs), so
  sanitization can't strip the link — don't widen the DOMPurify allowlist.

## Plan

1. Add `model` + `config` inputs to `MarkdownReader` and a `navigate = output<string>()`.
   Compute `resolveReferences(body, model, config)` and reduce it to a
   `Map<id, ReferenceTarget>` of the resolved ids.
2. After render+sanitize, run a DOM pass over the `[innerHTML]` host (e.g. an
   `afterRenderEffect` / `ViewChild` ElementRef): walk text nodes, match
   `config.references.idPattern`, and wrap each resolved id in `<a data-path="…">`; leave
   unresolved ids as plain text with a class marking them inert. Skip text already inside an
   anchor.
3. One delegated click listener on the host: when the click target carries `data-path`,
   `preventDefault()` and emit `navigate(path)`.
4. In `WikiView`, build a `VaultModel` once (read + `parseFile` all files → `buildModel`),
   keep it and `config` as signals, pass them to `<app-markdown-reader>`, and bind
   `(navigate)="select($event)"` (reuse the existing `select`).
5. Tests: a body with a bare `F-001` yields a clickable node whose `data-path` is F-001's
   file; an unresolved id stays inert; a click emits `navigate`.

## Acceptance

- [ ] A bare `F-001` mention navigates to F-001's file in the reader (MVP acceptance #3).
- [ ] Clicks are handled by delegation, not per-link bindings.
- [ ] Unresolved ids are visibly non-links and do nothing on click.
- [ ] Decoration runs on the post-sanitize DOM (no source-offset indexing into HTML).
- [ ] `MarkdownReader` gains `model`/`config` inputs and a `navigate` output; `WikiView`
      builds the model and wires `navigate` to `select(path)`.

## Dependencies

- **Depends on:** F-001-S-03, F-003-S-02. **Blocks:** F-004-S-04 (cards link the same way).

## Out of scope

The resolution algorithm (F-001-S-03) and the renderer itself (F-003-S-02). Wiring clicks to
navigation only.

## References

ADR-002; `docs/05-VAULT_SPEC.md` §7.
