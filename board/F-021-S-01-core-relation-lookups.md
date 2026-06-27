---
id: F-021-S-01
type: story
title: Core relation lookups — childrenOf & dependentsOf
status: Todo
priority: P1
owner: mozart
parent: F-021
estimate: S
touches: [core]
created: 2026-06-21T09:31:58Z
updated: 2026-06-21T09:31:58Z
---

# F-021-S-01 — Core relation lookups: childrenOf & dependentsOf

The card page and side peek (F-021) show a card's relations — its children with a progress
summary, and its *dependents* (the cards that name it in `dependsOn`). This story adds the
two pure-core lookups that produce that data, so the web surfaces (F-021-S-02, F-021-S-03)
and the board's container progress (F-022) read one source instead of re-deriving relations
view-side. It is the shared enabler the rest of the feature builds on.

## Outcome

- `packages/core` exposes `childrenOf(id)` — the cards whose `parent` resolves to `id` —
  and `dependentsOf(id)` — the reverse of `dependsOn` (cards that name `id`). Both are pure
  functions over the built vault model, exported from the core barrel
  (`packages/core/src/index.ts`).
- A children-progress rollup (n done / m total, where *done* = mapped to the last column)
  is available for the relations summary, reusing core's existing column mapping rather
  than hardcoding a "done" state. F-022's container progress chip reuses this same rollup.
- Dependents reuse the already-resolved dependency edges (`deriveBlocks` / the edge set),
  not a fresh scan; parent → child resolution is the new piece.
- Unit tests cover: a parent with children, a card with none, multi-level parents, an
  unresolved `parent`, and dependents with/without incoming edges.

## Context — read before starting

- Parent feature F-021 — the page/peek surfaces these lookups feed; read it for the
  relations the UI renders.
- [`packages/core/src/edges.ts`](../packages/core/src/edges.ts) — `buildEdges` /
  `deriveBlocks` already resolve dependency edges (the inverse of `dependsOn`);
  `dependentsOf` is the lookup over that. `DEPENDS_ON_FIELD` lives here.
- [`packages/core/src/models.ts`](../packages/core/src/models.ts) — the `VaultModel`
  (cards by id, `parent` resolved) these functions read.
- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `isCardDone`
  and the column mapping; the progress rollup's "done = last column" comes from here, never
  a literal state name.
- [`packages/core/src/index.ts`](../packages/core/src/index.ts) — the barrel every new core
  export is added to.
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)
  — core is pure.

## Constraints (must honor)

- **Pure core (ADR-001):** functions of the model, no I/O, no throw; unresolved ids are
  reported/skipped, never crashed on.
- **Don't double-maintain edges:** dependents derive from the existing edge set; never
  store a reverse field.
- **Config-driven "done" (ADR-003):** the progress rollup maps state → column via core's
  placement, never a hardcoded state name — works for recipe-box's vocabulary unchanged.

## Plan

1. Add `childrenOf(id)` (parent → children resolution) and `dependentsOf(id)` (over the
   edge set) to core, plus a children-progress helper (n/m done via column mapping).
2. Export them from [`packages/core/src/index.ts`](../packages/core/src/index.ts).
3. Vitest: the cases above (children, none, multi-level, unresolved parent, dependents).
4. Gate: `bunx vitest run` directly in `packages/core` (dodge the cross-worktree cache).

## Acceptance

- [ ] `childrenOf` and `dependentsOf` are exported from the core barrel and pure (no I/O,
      no throw); an unresolved `parent` or id is handled, not crashed on.
- [ ] The progress rollup computes n/m done via core's column mapping (done = last column),
      not a hardcoded state.
- [ ] Unit tests cover children / none / multi-level / unresolved parent / dependents.
- [ ] `packages/core` tests are green.

## Dependencies

- **Depends on:** — (pure core; the feature's F-023 dependency is for the web hosts, not
  this story). **Blocks:** F-021-S-02, F-021-S-03, and F-022's container progress.

## Out of scope

The detail component, routes, peek, and any rendering (F-021-S-02 / F-021-S-03);
`isContainer` / board container-exclusion (F-022). Core lookups only.

## References

F-021; [`packages/core/src/edges.ts`](../packages/core/src/edges.ts);
[`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts);
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database).
