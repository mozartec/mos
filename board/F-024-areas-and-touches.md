---
id: F-024
type: feature
title: Areas & touches — declared file surfaces
status: Draft
priority: P1
phase: Phase 4
owner: mozart
created: 2026-06-12T18:30:00Z
updated: 2026-06-12T18:30:00Z
---

# F-024 — Areas & touches — declared file surfaces

After this ships, a card can say which parts of the repo it will change, and the vault
can compute which ready cards are safe to work in parallel — `dependsOn` answers "what
is unblocked", `touches` answers "what won't collide". This is the data layer the
parallel-aware skills (F-025) and board indicators (F-026) build on.

## Outcome

- **Config (spec 0.4, additive —
  [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)):**
  an `areas` map of vault-defined names to glob lists (e.g. `"web": ["apps/web/**"]`),
  and a `touches` list field whose values are area names. Both optional; a vault without
  them validates and renders unchanged.
- **Core:** pure helpers — resolve a card's `touches` against `areas`, and
  `parallelBatch(cards, config)` returning ready cards (dependencies done) whose
  `touches` are pairwise disjoint, with the conflicting pairs it excluded.
- **Validator:** flags a `touches` entry that names no configured area; warns when two
  In Progress cards declare overlapping areas.
- **This vault:** `areas` defined in [`.mos/config.json`](../.mos/config.json) (e.g.
  `core`, `web`, `skills`, `docs`, `board`, `ci`), `touches` added to the field registry
  and card fields, and every non-done card backfilled.
- **Conventions:** [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) documents that
  the writing agent fills `touches` at planning time and keeps it honest when scope
  changes.

## Context — read before starting

- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  — the decision this implements, including what stays future work (git-computed
  verification).
- [ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph)
  — the existing ready-set math this extends (dependency edges, F-012).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — §config and §5a field types;
  `areas`/`touches` join the 0.4 spec.
- [`packages/core`](../packages/core) — config parsing and the field registry the new
  field type plugs into.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — where the new checks
  land, next to the existing list-of-id validation.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — the card template the
  `touches` guidance joins.

## Constraints (must honor)

- **Pure core** ([ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)):
  batch computation is plain data in, plain data out — no git, no filesystem.
- **Config-driven** ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
  area names and globs are vault-defined; nothing assumes this repo's layout.
- **Read-only app** ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)):
  `touches` is written by agents, never by the app.
- **Additive spec:** vaults without `areas`/`touches` see zero behavior change and zero
  new warnings.

## Plan

1. Spec: document `areas` and `touches` in
   [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) under 0.4.
2. Core: parse `areas`; `touches` field type; `parallelBatch(cards, config)` + unit
   tests (overlap, missing `touches`, unfinished dependencies, no-areas vault).
3. Validator: unknown-area check; In Progress overlap warning; keep area-less vaults
   warning-free.
4. This vault: define `areas`, add `touches` to the field registry, type card fields,
   and `fieldOrder`; backfill `touches` on all non-done cards (frontmatter-only edits,
   `updated` bumped).
5. Conventions: add the `touches` planning-time guidance to
   [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md).
6. `bun run validate`; scoped core tests.

## Acceptance

- [ ] [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) documents `areas` and
      `touches` as optional 0.4 config; a vault without them validates with no new
      warnings.
- [ ] Core exposes a pure parallel-batch function (ready ∧ pairwise-disjoint `touches`)
      that also reports excluded conflicting pairs, unit-tested for overlap, missing
      declarations, and unfinished dependencies.
- [ ] The validator flags a `touches` value that names no configured area, and warns
      when two In Progress cards overlap.
- [ ] This vault's config defines `areas`, and every non-done card declares `touches`.
- [ ] [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) documents when and how
      agents set `touches`.

## Dependencies

- **Depends on:** nothing — but it shares the `packages/core` config surface with
  F-023, so sequence the two rather than working them in parallel (the situation this
  feature exists to make machine-checkable). **Blocks:** F-025, F-026.

## Out of scope

Skill changes (F-025), board/graph indicators (F-026), git-computed verification of
declarations against diffs (future ADR), and any write path in the app
([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)).

## References

[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-011](../docs/08-DECISIONS.md#adr-011--three-lenses-wiki-board-and-dependency-graph),
[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md).
