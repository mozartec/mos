---
id: F-001-S-03
type: story
title: Resolve references by id
status: Done
priority: P0
owner: mozart
sprint: S2
parent: F-001
estimate: M
dependsOn: [F-001-S-02, F-002-S-01]
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T00:18:00Z
---

# F-001-S-03 — Resolve references by id

Find references in a body — markdown links, bare ids (see F-002), and optional [[F-002]] —
and resolve each to a target card/doc by id.

## Outcome

`packages/core` exposes `resolveReferences(body, model, config) -> Reference[]`, where each
reference records its source span, the matched `id`, and the resolved target (a card or doc
path) or `unresolved`. The wiki turns these into clickable links (F-003-S-03). Resolution is
purely by `id`, so links survive file renames.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §7 — the three reference forms
  (markdown link, bare id, `[[id]]`) and "resolution is by id; the id shape is a config
  regex."
- F-001-S-02 — the `model` (cards by id, doc paths) references resolve against.
- F-002-S-01 — config provides the id-shape regex; do not hardcode the `F-`/`T-` pattern.

## Constraints (must honor)

- Pure core: operates on the body string + the model. No DOM, no `fs`. (ADR-001)
- Config-driven id shape: the bare-id matcher comes from a config regex, not a literal.
  (ADR-003, VAULT_SPEC §7)
- Don't rewrite the body — return spans/metadata; the renderer (F-003) decorates.

## Plan

1. Build an id matcher from the config's id regex; scan the body for bare ids, `[[id]]`, and
   markdown links whose text/target contains an id.
2. For each hit, look the id up in `model.cards` (then doc index); attach the target or mark
   `unresolved`.
3. Return references with character offsets so the renderer can decorate precisely. Vitest:
   "see F-002" with and without an existing markdown link; an unresolved id; rename safety
   (resolve by id after a path change in the fixture).

## Acceptance

- [x] "see F-002" resolves to F-002 regardless of a markdown link existing.
- [x] Resolution is by id, surviving file renames. Id shape comes from config regex.
- [x] An id with no target is returned as `unresolved` (not dropped, not thrown).

## Dependencies

- **Depends on:** F-001-S-02, F-002-S-01. **Blocks:** F-003-S-03 (clickable links).

## Out of scope

Turning references into DOM/links (F-003-S-03) and markdown rendering (F-003-S-02). This
story produces resolution metadata only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §7.
