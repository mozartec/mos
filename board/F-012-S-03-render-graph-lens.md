---
id: F-012-S-03
type: story
title: Render the Graph lens in the web app
status: Done
priority: P1
owner: mozart
parent: F-012
estimate: L
dependsOn: [F-012-S-02, F-003-S-02, F-004-S-04]
created: 2026-06-08T12:45:00Z
updated: 2026-06-09T23:40:00Z
---

# F-012-S-03 — Render the Graph lens

Add a third lens to `apps/web`: a `GraphView` that draws the layered dependency graph from
core, with nodes coloured by status and a click-through into the card reader.

## Outcome

`apps/web` gains a Graph lens, navigable alongside Wiki and Board. It renders the
`buildDependencyGraph` output as SVG: nodes positioned by `rank`/`order`, directional edges
prerequisite → dependent, node colour by status (Done/In Progress/Blocked/Todo), and a label
with id + title. Clicking a node opens that card in the F-003 reader (reusing F-004-S-04's
open-in-reader path). Opening this repo as a vault shows the same dependency structure this
backlog actually has.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Inside an app — `GraphView` in
  `views/graph/`; reuse `components/` (card face, reader) rather than forking.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002 (read-only), ADR-004 (lenses
  are independent; clicking a node opens the shared reader). Add the "three lenses" ADR here
  before starting (see the feature card's Out of scope).
- F-012-S-02 (the graph model), F-003-S-02 (reader/renderer), F-004-S-04 (open-in-reader),
  T-006 (icons/fonts) for node polish.
- `apps/web/AGENTS.md` — Angular standalone components, signals, external templates.

## Constraints (must honor)

- **Read-only.** Render and navigate only — no drag, no edge editing, no status changes.
  (ADR-002)
- **Thin projection.** All geometry comes from core (S-02); the component positions and
  paints, it does not compute ranks. (ADR-001 boundary)
- **Reuse the reader.** Node click opens the F-003 reader via the F-004-S-04 path; don't
  build a second reader. (ADR-004)
- Standalone components + signals; external templates; Tailwind + daisyUI; Tabler icons.

## Plan

0. Write the "three lenses" ADR in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) recording
   the decision to add a Graph lens alongside Wiki and Board.
1. New `GraphView` (`views/graph/`), routable/toggleable like Wiki and Board.
2. Render nodes from `{ rank, order }` into an SVG/lay grid; draw edges as arrows; colour by
   status; show id + title; flag any cycle-broken edge.
3. Wire node selection to the shared reader (F-004-S-04 event), with a way back.
4. Component tests: node count/placement from a fixture model; click emits the open event.

## Acceptance

- [x] A Graph lens renders nodes + directional edges from the core graph model.
- [x] Nodes are coloured by status and labelled with id + title; cycle-broken edges are marked.
- [x] Clicking a node opens the card in the F-003 reader with a way back.
- [x] Opening this repo as a vault reproduces its real dependency graph.

## Dependencies

- **Depends on:** F-012-S-02, F-003-S-02, F-004-S-04; polish from T-006.
  **Blocks:** F-012-S-04 (highlights decorate this view).

## Out of scope

Critical-path / ready-set highlighting (S-04), editing dependencies, zoom/pan/minimap niceties
(graduate later only with a concrete need). Static layered render + click-through only.

## References

ADR-001, ADR-002, ADR-004; `docs/03-ARCHITECTURE.md`, `apps/web/AGENTS.md`.
