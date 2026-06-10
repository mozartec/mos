---
id: F-012
type: feature
title: Dependency graph lens
status: Done
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [F-001-S-02, F-001-S-03, F-002-S-01, F-003-S-02, F-004-S-04]
created: 2026-06-08T12:45:00Z
updated: 2026-06-10T00:18:00Z
---

# F-012 — Dependency graph lens

A third read-only lens that renders the cards as a directed graph of their dependencies, so
a maintainer (or an agent) can see at a glance the critical path, what is blocked, and which
cards are ready to start in parallel right now. This is mos's first lens whose value is the
*structure between* cards rather than any single card.

## Outcome

After this feature, opening this repo as a vault offers a **Graph** lens alongside Wiki and
Board. Nodes are cards, edges are "depends on" relations, the layout flows from prerequisites
to dependents, node colour reflects status, and clicking a node opens the card in the F-003
reader. The graph also highlights the **critical path** and the **ready set** (cards whose
dependencies are all `Done`) — the same answer this app should give to "what can I kick off
together?" Dependencies become first-class structured data (a frontmatter field), not prose,
so both the lens and future agents/MCP can read them.

## Context — read before starting

- [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md) §Lens — a lens is a read-only way of looking
  at the vault; this adds a third, independent one.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — the new `GraphView`
  lives in `apps/web/.../views/graph/`; keep it a thin projection over a core graph model.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4 (fields) and §5a (field-types
  registry) — `dependsOn` is added as a typed, list-of-`id` field, the way `parent` is a
  single `id`.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-004 (two independent lenses) is the
  precedent this extends; adding a third lens warrants a new ADR (see Out of scope).
- [`docs/07-ROADMAP.md`](../docs/07-ROADMAP.md) — this graduates "dependency-graph
  visualization" from unscheduled ideas into Phase 2.

## Constraints (must honor)

- **Read-only.** The lens only renders; it never writes edges or reorders cards. (ADR-002)
- **Core is pure.** Graph construction, layout, cycle detection, critical-path and ready-set
  computation live in `packages/core` — strings/objects in, a graph model out, no `fs`/DOM.
  (ADR-001)
- **Config-driven.** `dependsOn` is declared in the field registry and each type's
  `card.fields`; nothing about the relation is hardcoded in the view. (ADR-003)
- **Reuse, don't fork.** Opening a node reuses the F-003 reader; don't build a second reader.
  (ADR-004)

## Plan

Stories in order: structure the edges in core + config and backfill existing cards (S-01),
compute a layered DAG layout in core (S-02), render the `GraphView` in the web app (S-03),
then highlight critical path + ready set (S-04). Each builds on the pure core so the view
stays a thin projection.

## Acceptance

- [x] A `dependsOn` frontmatter field exists, is typed, and existing cards' prose
      dependencies are backfilled into it without losing the prose.
- [x] Core exposes a dependency-graph model (nodes, edges, ranks) with cycle detection.
- [x] The web app has a Graph lens: nodes coloured by status, edges directional, click opens
      the card in the F-003 reader.
- [x] The lens highlights the critical path and the ready set; both are also available as
      core data (so MCP/agents can consume them later).

## Stories

F-012-S-01, F-012-S-02, F-012-S-03, F-012-S-04

## Dependencies

- **Depends on:** F-001-S-02 (vault model), F-001-S-03 (reference resolution),
  F-002-S-01 (config + field registry); for the view, F-003-S-02 (renderer) and
  F-004-S-04 (open-in-reader). Effectively starts once the MVP model layer lands.
- **Blocks:** — (Phase 2; nothing in the MVP depends on it.)

## Out of scope

Editing dependencies in the app (a write — stays in the agent layer / future F-011), the MCP
`createTask`/`setStatus` server (F-009), and authoring the ADR that records "three lenses" —
add that ADR in `08-DECISIONS.md` as a precondition to S-03, don't bury the decision in a card.

## References

ADR-001, ADR-002, ADR-003, ADR-004; `docs/02-CONCEPTS.md`, `docs/03-ARCHITECTURE.md`,
`docs/05-VAULT_SPEC.md`, `docs/07-ROADMAP.md`.
