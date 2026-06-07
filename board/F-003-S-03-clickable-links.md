---
id: F-003-S-03
type: story
title: Clickable internal links
status: Todo
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
- F-001-S-03 — the `Reference[]` (spans + targets) this story decorates.
- F-003-S-02 — the rendered HTML these links attach to.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002 (navigation only; no writes).

## Constraints (must honor)

- Read-only navigation; clicking opens the target in the reader, never edits.
- Use **event delegation** over the rendered container (one listener), not per-link
  handlers, so it scales with document size.
- Decorate from core's resolution metadata — don't re-parse ids in the component.

## Plan

1. After render, map core's reference spans onto the output (data-id attributes on the
   relevant nodes), marking resolved vs unresolved.
2. One delegated click handler on the reader container: on a resolved `data-id`, navigate
   the wiki to the target path; ignore unresolved.
3. Tests: a body with a bare id resolves and navigates; an unresolved id stays inert.

## Acceptance

- [ ] A bare `F-001` mention navigates to F-001's file in the reader (MVP acceptance #3).
- [ ] Clicks are handled by delegation, not per-link bindings.
- [ ] Unresolved ids are visibly non-links and do nothing on click.

## Dependencies

- **Depends on:** F-001-S-03, F-003-S-02. **Blocks:** F-004-S-04 (cards link the same way).

## Out of scope

The resolution algorithm (F-001-S-03) and the renderer itself (F-003-S-02). Wiring clicks to
navigation only.

## References

ADR-002; `docs/05-VAULT_SPEC.md` §7.
