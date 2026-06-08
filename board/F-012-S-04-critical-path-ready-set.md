---
id: F-012-S-04
type: story
title: Critical path and ready-set highlighting
status: Todo
priority: P1
owner: mozart
parent: F-012
estimate: M
created: 2026-06-08T12:45:00Z
updated: 2026-06-08T12:45:00Z
---

# F-012-S-04 — Critical path and ready-set highlighting

Compute, and visibly highlight, the two questions that drive throughput: what is the longest
dependency chain (the critical path), and which cards can be started right now (the ready
set — all dependencies `Done`). This is the productivity payload of the lens.

## Outcome

`packages/core` exposes `criticalPath(graph)` (the longest prerequisite chain) and
`readySet(graph)` (cards whose every dependency is `Done` and which are not themselves
`Done`). The Graph lens highlights the critical path (e.g. emphasised edges/nodes) and badges
the ready set, so "what can I kick off together?" is answerable by looking. Both results are
plain core data, so a later MCP/agent (F-009) can consume them without the UI.

## Context — read before starting

- F-012-S-02 (graph model with ranks) and F-012-S-03 (the view to decorate).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-001 (the computation is pure core;
  the view only paints the result).
- [`docs/07-ROADMAP.md`](../docs/07-ROADMAP.md) / F-009 — keep the outputs UI-free so the
  future MCP server can reuse them.

## Constraints (must honor)

- **Pure core.** `criticalPath` / `readySet` are deterministic functions of the graph +
  statuses; no DOM, no framework. (ADR-001)
- **Read-only view.** Highlighting decorates the existing lens; it changes nothing in the
  vault. (ADR-002)
- **Status comes from the model**, via the configured status field — not hardcoded strings
  beyond the type's declared `Done` state. (ADR-003)

## Plan

1. In core: `readySet` = nodes with no non-`Done` prerequisite and status ≠ `Done`;
   `criticalPath` = longest path by node count (or estimate weight if available).
2. Expose both on/alongside the graph model so view and future MCP share one source.
3. In `GraphView`: emphasise the critical path and badge ready-set nodes; add a legend.
4. Tests: ready set on a partly-`Done` fixture; critical path on a diamond; both update when a
   node flips to `Done`.

## Acceptance

- [ ] `readySet` returns exactly the cards whose dependencies are all `Done` and are not
      themselves `Done`.
- [ ] `criticalPath` returns the longest prerequisite chain.
- [ ] The Graph lens visibly highlights the critical path and badges the ready set, with a
      legend.
- [ ] Both computations are available as core data independent of the UI.

## Dependencies

- **Depends on:** F-012-S-02, F-012-S-03. **Blocks:** —

## Out of scope

Scheduling/assignment, estimate-weighted forecasting beyond a simple path length, and any
write-back. Compute + highlight only.

## References

ADR-001, ADR-002, ADR-003; `docs/07-ROADMAP.md`.
