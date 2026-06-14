---
id: F-028
type: feature
title: Config-named in-flight column(s) — beyond the positional penultimate rule
status: Draft
priority: P3
phase: Future
owner: mozart
dependsOn: [F-026]
touches: [core, config, scripts, docs]
created: 2026-06-14T08:53:28Z
updated: 2026-06-14T08:53:28Z
---

# F-028 — Config-named in-flight column(s) — beyond the positional penultimate rule

Today "in flight" is positional: `inFlightColumn(config)` returns the single column before
the last — the counterpart of "last column is done"
([`05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c). That heuristic holds for boards with
one active column (this vault: `Backlog · Planned · In Progress · Done`, where `Planned` is
queued, not in flight). It **under-detects** on boards with several active columns between
backlog and done: on `Todo · Doing · Review · Done` only `Review` counts, so two `Doing`
cards sharing an area show no collision badge (F-026) and a card overlapping `Doing` work is
still marked safe-to-start. This feature lets a vault name its in-flight column(s) in config,
with the positional rule as the default.

## Outcome

- **Config can name the in-flight column(s):** an optional `board.inFlightColumns` (a list of
  column names) designates which columns count as "work in progress". Absent ⇒ today's
  positional default (the column before the last; none when fewer than three columns).
- **One owner, honored everywhere:** `inFlightColumn`/`parallelOverlaysActive` in
  [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) become the single
  source the F-026 selectors and the validator read; the positional fallback lives there.
- **Zero-config unchanged:** a vault that names nothing behaves exactly as it does today.

## Context — read before starting

- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  — the parallel-batch model F-026 renders; this widens "in flight".
- [ADR-020](../docs/08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)
  — the precedent for config-named (not format-imposed) board structure; the design call
  F-026 deferred. Decide whether this warrants a short ADR of its own.
- [ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)
  — config-driven columns/states; nothing hardcoded.
- [`packages/core/src/place-card.ts`](../packages/core/src/place-card.ts) — `inFlightColumn`,
  `parallelOverlaysActive`, and the positional rule's docstring (already flags this gap).
- [`packages/core/src/parallel.ts`](../packages/core/src/parallel.ts) — `inFlightCollisions`,
  `safeToStart` (today assume a single column).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the zero-dependency
  validator inlines the same one-liner (it can't import core's TS); keep the two in step.

## Constraints (must honor)

- **Pure core** ([ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)):
  the derivation stays a pure function of config; the app only reads it.
- **Config-driven** ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
  no hardcoded column names; validate that named columns exist in `board.columns`.
- **Backward compatible:** the positional default is exactly today's behavior — existing
  vaults and tests must not change.

## Plan

1. Spec: add `board.inFlightColumns` to [`05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c
   (and §6 config shape). Decide on a small ADR per ADR-020's precedent.
2. Core: `inFlightColumns(config): string[]` (plural) honoring config, positional fallback;
   reframe `inFlightColumn`/`parallelOverlaysActive` and the F-026 selectors over the set.
   Unit tests for the multi-column board the positional rule misses.
3. Validator: read the same config (keep the inline copy faithful to core); warn on a named
   column that isn't in `board.columns`.
4. Web: no new UI — board/graph overlays already render whatever the selectors return; add a
   regression test on a multi-active-column board.

## Acceptance

- [ ] On `Todo · Doing · Review · Done` with `board.inFlightColumns: [Doing, Review]`, two
      `Doing` cards sharing an area collide, and a ready card overlapping a `Doing` card is
      not safe-to-start — proven by a pure core unit test.
- [ ] With no `board.inFlightColumns`, every existing test and vault behaves identically
      (positional default = the column before the last).
- [ ] The validator honors `board.inFlightColumns` and flags a named column absent from
      `board.columns`; `bun run validate` stays green on this repo.

## Dependencies

- **Depends on:** F-026 (ships the positional rule and the selectors this generalizes).
  **Blocks:** nothing.

## Out of scope

Git-diff verification of declared surfaces (future ADR), and any change to the safe-to-start
or collision *semantics* beyond which columns count as in flight.

## References

[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-020](../docs/08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint),
[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md).
