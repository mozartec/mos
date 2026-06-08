---
id: F-012-S-02
type: story
title: Layered DAG layout in core
status: Todo
priority: P1
owner: mozart
parent: F-012
estimate: M
created: 2026-06-08T12:45:00Z
updated: 2026-06-08T12:45:00Z
---

# F-012-S-02 — Layered DAG layout in core

Turn the dependency edge set into a positioned, layered graph the view can render directly,
computed entirely in the pure core.

## Outcome

`packages/core` exposes `buildDependencyGraph(model) -> { nodes, edges }` where each node
carries `{ id, rank, order, status, title }` and each edge carries `{ from, to }`. `rank` is
the longest-path depth from a root (a card with no dependencies), so prerequisites sit left
of dependents; `order` is a stable within-rank position. Cyclic input degrades gracefully
(break the back-edge, flag it) rather than looping. No DOM, no framework — geometry only.

## Context — read before starting

- F-012-S-01 — the edge set and node model this consumes.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) — core stays pure; the view is a
  thin projection, so layout (ranks + ordering) belongs here, not in the component.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-001 (pure core).

## Constraints (must honor)

- **Pure core.** Deterministic geometry from the model; same input → same layout. No `fs`,
  no DOM, no random. (ADR-001)
- **No-throw on cycles.** A cycle is flagged in output, never an infinite loop or exception.
- Keep it dependency-light — a small longest-path layering, not a heavyweight graph library,
  unless `04-TECH_STACK.md` already sanctions one.

## Plan

1. Topologically order the DAG; assign `rank` = longest path from any root.
2. Assign a stable `order` within each rank (e.g. by `priority` then `id`) to keep layout
   deterministic and readable.
3. Return `{ nodes, edges }`; mark any back-edge from cycle-breaking so the view can show it.
4. Vitest: a linear chain, a diamond (fan-out/fan-in), a disconnected node, and a cycle.

## Acceptance

- [ ] `buildDependencyGraph` returns ranked, ordered nodes plus edges, deterministically.
- [ ] Roots are rank 0; a dependent is always a higher rank than each of its prerequisites.
- [ ] Cyclic input returns a flagged result instead of looping/throwing.
- [ ] Unit tests cover chain, diamond, disconnected, and cyclic graphs.

## Dependencies

- **Depends on:** F-012-S-01. **Blocks:** F-012-S-03, F-012-S-04.

## Out of scope

Any rendering or interaction (S-03) and critical-path/ready-set semantics (S-04). Pure layout
geometry only.

## References

ADR-001; `docs/03-ARCHITECTURE.md`, `docs/04-TECH_STACK.md`.
