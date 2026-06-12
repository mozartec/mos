---
id: F-026
type: feature
title: Parallel batches on the board — collision badges and safe-to-start
status: Draft
priority: P2
phase: Future
owner: mozart
dependsOn: [F-023, F-024]
created: 2026-06-12T18:30:00Z
updated: 2026-06-12T18:30:00Z
---

# F-026 — Parallel batches on the board — collision badges and safe-to-start

The skills can already answer "what can run in parallel" (F-025) — this feature makes
the same answer visible without asking: in-flight cards that declare overlapping areas
carry a collision badge, and ready cards that won't collide with anything in flight are
highlighted as safe to start. The board becomes the orchestrator's command center
described in [`docs/14-PERSONAS.md`](../docs/14-PERSONAS.md).

## Outcome

- **Collision badges:** two or more In Progress cards declaring a shared area show a
  small indicator naming the overlap, on the board and the graph lens.
- **Safe-to-start highlight:** ready cards (dependencies done) whose `touches` are
  disjoint from every In Progress card get a subtle highlight; the graph lens ready-set
  ([ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph))
  gains the same distinction.
- **Derived, not stored:** all of it computed by pure core selectors over cards +
  config; vaults without `areas` see no change anywhere.

## Context — read before starting

- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  — the batch semantics; F-024 ships the core function this renders.
- [ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph)
  — the graph lens and ready-set math being extended.
- [`apps/web/src/views/board`](../apps/web/src/views/board) — where badges and
  highlights land after F-023's restructure.
- [`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md) — token-only color and the
  existing badge idioms.

## Constraints (must honor)

- **Pure core** ([ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)):
  collision/safety selectors are pure; the app only renders them.
- **Read-only** ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)):
  no scheduling or assignment from the UI.
- **Design system** ([ADR-016](../docs/08-DECISIONS.md#adr-016--design-system-ink--highlight-over-stock-themes)):
  semantic tokens only; badges follow existing chip idioms.
- **Zero-config silence:** vaults without `areas` render exactly as before.

## Plan

1. Core: selectors for in-flight collisions and safe-to-start cards over the F-024
   batch function; unit tests.
2. Board: collision badge + safe-to-start highlight per design-system idioms.
3. Graph lens: same distinction in the ready-set rendering.
4. Specs for both states; `bun run validate` untouched (no data change).

## Acceptance

- [ ] Two In Progress cards declaring a shared area show a collision badge naming it,
      on board and graph lens.
- [ ] Ready cards disjoint from all in-flight work are visibly distinct from ready
      cards that would collide; the logic is a pure, unit-tested core selector.
- [ ] A vault without `areas` renders identically to today — no badges, no highlights,
      no warnings.

## Dependencies

- **Depends on:** F-023 (board structure and filter bar), F-024 (`touches` data and
  batch math). **Blocks:** nothing.

## Out of scope

Skill behavior (F-025), git-diff verification (future ADR), manual drag/assignment, and
any write path
([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)).

## References

[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database),
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph),
[ADR-016](../docs/08-DECISIONS.md#adr-016--design-system-ink--highlight-over-stock-themes),
[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches);
[`docs/13-DESIGN_SYSTEM.md`](../docs/13-DESIGN_SYSTEM.md);
[`docs/14-PERSONAS.md`](../docs/14-PERSONAS.md).
