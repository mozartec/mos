---
id: T-014
type: task
title: Graph ready dot shouldn't mark already-started (in-flight) cards
status: Todo
priority: P3
phase: Future
owner: mozart
dependsOn: [F-026]
touches: [web]
created: 2026-06-14T12:29:13Z
updated: 2026-06-14T12:29:13Z
---

# T-014 — Graph ready dot shouldn't mark already-started (in-flight) cards

The dependency ready set ([ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph),
shipped in F-012) is "every dependency done, not done itself" — which includes **in-flight**
cards (an In Progress card is unblocked and not done). The graph lens
([`apps/web/src/views/graph/graph-view.ts`](../apps/web/src/views/graph/graph-view.ts)) draws
a ready dot on every such node. Before F-026 that was a solid accent dot reading "Ready to
start"; F-026 split it into safe (solid) vs not-confirmed-safe (hollow), so an *already
started* card now shows a hollow dot whose tooltip talks about being "ready" / "not confirmed
safe" — which reads oddly for work that is, by definition, already underway. This was a
pre-existing oddity F-026 only reworded (noted in
[PR #58](https://github.com/mozartec/mos/pull/58) re-review); this task cleans it up.

## Outcome

- In-flight cards (in the in-flight column, `inFlightColumn`) carry **no ready dot** on the
  graph — "ready to start" / "safe to start" applies only to work not yet started.
- The safe-vs-hollow split (F-026) therefore applies only to not-yet-started ready cards;
  collision markers on in-flight cards are unaffected.
- Pure-core ready-set semantics are unchanged (see "Decision" — keep this a lens concern).

## Context — read before starting

- [`apps/web/src/views/graph/graph-view.ts`](../apps/web/src/views/graph/graph-view.ts) —
  the `nodes` computed sets `ready`/`safe`/`dotFilled`/`readyTitle`; `readyIds` comes from
  core `readySet`. The fix narrows what gets a dot, not what `readySet` returns.
- [`apps/web/src/views/graph/graph-view.html`](../apps/web/src/views/graph/graph-view.html) —
  the `@if (node.ready)` dot block.
- [`packages/core/src/graph.ts`](../packages/core/src/graph.ts) — `readySet`; **do not**
  change its meaning here (see Decision).
- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `inFlightColumn`
  to identify in-flight nodes.

## Decision (resolve before building)

Scope this to the **graph lens rendering**, not core `readySet`. `readySet` is also consumed
by the skills and (future) MCP as "what is unblocked"; redefining it to exclude in-flight
work would change those answers too and belongs in its own discussion. So: keep `readySet`
as-is and have the graph simply not paint a ready dot on an in-flight node. If a later need
arises to also drop in-flight from the *batch/skill* notion of ready, raise it separately.

## Constraints (must honor)

- **Pure core untouched** ([ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)):
  this is a rendering change; `readySet` and the F-026 selectors keep their behavior.
- **Zero-config silence:** a vault with no `areas` is unaffected (the dot already renders
  solid there; only in-flight nodes lose it, consistently in both modes).
- **Design system** ([ADR-016](../docs/08-DECISIONS.md#adr-016--design-system-ink--highlight-over-stock-themes)):
  no new idioms; just suppress the dot for in-flight nodes.

## Plan

1. In `graph-view.ts`, compute whether a node is in-flight (`placeCard(card, config).column
   === inFlightColumn(config)`) and gate the ready dot off for those nodes (e.g. a
   `showReadyDot = ready && !inFlight`), leaving collision markers and tones untouched.
2. Confirm the legend still reads correctly (ready entries describe not-yet-started work).
3. Tests: an In Progress card with deps done shows **no** `circle[data-ready]`; a Todo ready
   card still does; zero-config behavior unchanged.

## Acceptance

- [ ] An In Progress card whose dependencies are done shows no ready dot on the graph
      (`svg circle[data-ready]` absent for it), while a not-started ready card still shows one.
- [ ] The F-026 safe/hollow split and collision markers are unchanged for not-started and
      in-flight cards respectively; core `readySet` and selectors are untouched (unit tests
      still green).
- [ ] A vault with no `areas` renders the graph exactly as before this task.

## Dependencies

- **Depends on:** F-026 (introduced the safe/hollow ready-dot split this refines).
  **Blocks:** nothing.

## Out of scope

Changing core `readySet` semantics or the skills'/MCP notion of "ready" (separate
discussion); the board's safe-to-start highlight (already excludes in-flight via
`safeToStart`).

## References

[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database),
[ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph),
[ADR-016](../docs/08-DECISIONS.md#adr-016--design-system-ink--highlight-over-stock-themes).
