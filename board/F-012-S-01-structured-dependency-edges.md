---
id: F-012-S-01
type: story
title: Structured dependency edges (dependsOn field + core edges)
status: Todo
priority: P1
owner: mozart
parent: F-012
estimate: M
created: 2026-06-08T12:45:00Z
updated: 2026-06-08T12:45:00Z
---

# F-012-S-01 — Structured dependency edges

Make "depends on" a typed, machine-readable relation: add a `dependsOn` frontmatter field
(a list of card ids), teach the core model to resolve it into a typed edge set, and backfill
the existing cards' prose dependencies into the field.

## Outcome

`.mos/config.json` declares a `dependsOn` field (a list of `id`) and adds it to each card
type's `card.fields`. `packages/core` resolves each card's `dependsOn` into edges
`{ from, to }` (with `blocks` derived as the inverse — stored once, never double-maintained),
reports unresolved ids in `errors` (never throws), and detects cycles. Every current card in
`board/` carries a `dependsOn` frontmatter list equivalent to its `## Dependencies` prose,
with the prose left intact.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4 (fields) and §5a (field-types
  registry) — `parent` is a single `id`; `dependsOn` is the list-of-`id` analogue. If the
  registry has no list/array type yet, extend it minimally (e.g. `{ "type": "id", "list":
  true }`) and document it in §5a.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §7 — how ids resolve as references;
  edge resolution reuses the same id-resolution path as F-001-S-03.
- F-001-S-02 (vault model — the nodes) and F-001-S-03 (reference resolution) — the inputs.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-001 (pure core), ADR-003
  (config-driven), ADR-010 (frontmatter is typed data).

## Constraints (must honor)

- **Pure core, no-throw.** Edge build is a function over the model; unresolved/cyclic refs go
  to `errors`, never thrown. (ADR-001)
- **Config-driven.** The field name and type come from the registry; don't hardcode
  `dependsOn` semantics in the model beyond reading the configured field. (ADR-003)
- **Store one direction.** Persist `dependsOn` only; derive `blocks`. Never write both to a
  card's frontmatter.
- **Preserve prose** when backfilling — the `## Dependencies` section stays; you only add the
  frontmatter field and bump `updated`. (ADR-002 discipline)

## Plan

1. Add the `dependsOn` field to the field registry (§5a) and to each type's `card.fields` in
   `.mos/config.json`; extend the registry with a list-of-id type if needed.
2. In core, after the model builds, resolve `dependsOn` ids to edges; collect unresolved ids
   and any cycle into `errors`. Expose `edges` (and a derived `blocks` view) on the model.
3. Backfill: for every card in `board/`, read its `## Dependencies` prose and add the matching
   `dependsOn:` list to frontmatter; bump `updated`. Leave prose untouched.
4. Vitest fixtures: valid edges, an unresolved id, a self/cycle, and a card with no deps.

## Acceptance

- [ ] `dependsOn` is a typed field in config and on every card type's face.
- [ ] Core returns an edge set; unresolved ids and cycles surface in `errors`, not thrown.
- [ ] All existing `board/` cards carry `dependsOn` matching their prose; prose unchanged.
- [ ] `bun run validate` passes.

## Dependencies

- **Depends on:** F-001-S-02, F-001-S-03, F-002-S-01. **Blocks:** F-012-S-02.

## Out of scope

Layout, rendering, critical-path/ready-set math (S-02/S-04), and any in-app editing of
dependencies. Data model + config + backfill only.

## References

ADR-001, ADR-003, ADR-010; `docs/05-VAULT_SPEC.md` §4, §5a, §7.
