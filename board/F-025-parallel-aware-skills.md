---
id: F-025
type: feature
title: Parallel-aware skills — batch picks and overlap pre-flight
status: Draft
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-024]
created: 2026-06-12T18:30:00Z
updated: 2026-06-12T18:30:00Z
---

# F-025 — Parallel-aware skills — batch picks and overlap pre-flight

Today [`next-card`](../skills/next-card/SKILL.md) recommends exactly one card and
[`ship-card`](../skills/ship-card/SKILL.md) starts building without asking what else is
in flight. After this feature, next-card can answer "what can I run *in parallel* right
now?" with a conflict-free batch, and ship-card warns before building a card whose
declared surface overlaps work already in progress — closing the loop where
independently planned tasks meet again as merge conflicts.

## Outcome

- **next-card batch mode:** asked for parallel work (e.g. `--parallel 3`), the script
  returns up to N ready cards whose `touches` are pairwise disjoint, and names the
  cards it excluded with the conflicting area for each. The single-pick behavior is
  unchanged.
- **ship-card pre-flight:** before planning, the script compares the named card's
  `touches` with every In Progress card's; an overlap is surfaced as a doubt ("X is in
  flight and also touches `web`") before any building starts.
- **Graceful degradation:** in a vault with no `areas`/`touches`, batch mode falls back
  to the ready set with an explicit caveat that file overlap is unknown; pre-flight
  stays silent.
- **Installed copies refreshed** via the skills CLI with `skills-lock.json` updated
  (T-009), and skill versions bumped per [`skills/README.md`](../skills/README.md).

## Context — read before starting

- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  — the batch definition (ready ∧ pairwise-disjoint `touches`).
- F-024 — the spec/core/validator layer this consumes; reuse its semantics, don't
  re-derive them.
- [`skills/next-card/SKILL.md`](../skills/next-card/SKILL.md) and
  [`skills/next-card/scripts/next_card.py`](../skills/next-card/scripts/next_card.py) —
  the ranking and ready logic the batch mode extends.
- [`skills/ship-card/SKILL.md`](../skills/ship-card/SKILL.md) and
  [`skills/ship-card/scripts/ship_card.py`](../skills/ship-card/scripts/ship_card.py) —
  the pre-flight step the overlap check joins.
- T-009 — how installed copies under `.agents/skills/` are refreshed (never hand-edit
  them).

## Constraints (must honor)

- **Vault-agnostic & config-driven** ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
  area names come from the vault's config; nothing assumes this repo's vocabulary.
- **Write discipline** ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)):
  skills keep their documented frontmatter-only writes; the new logic is read-only
  analysis.
- **Degrade, don't demand:** vaults without `areas` keep today's behavior plus an
  honest caveat — no new required config.
- **Source of truth:** change [`skills/`](../skills/README.md), then reinstall;
  installed copies under `.agents/skills/` are never edited directly (T-009).

## Plan

1. `next_card.py`: batch mode — ready set, then greedy disjoint selection in rank
   order; report excluded conflicts with reasons; tests against fixture vaults with and
   without `areas`.
2. [`skills/next-card/SKILL.md`](../skills/next-card/SKILL.md): document the parallel
   question, the output shape, and the no-areas caveat.
3. `ship_card.py`: pre-flight overlap check against In Progress cards' `touches`;
   surface as a doubt, not a refusal.
4. [`skills/ship-card/SKILL.md`](../skills/ship-card/SKILL.md): document the pre-flight
   and the expected agent behavior on overlap.
5. Bump skill versions, reinstall into `.agents/skills/`, update `skills-lock.json`
   (T-009).

## Acceptance

- [ ] In this vault, asking next-card for 3 parallel cards returns ready,
      `touches`-disjoint picks and lists excluded conflicts with the overlapping area
      named.
- [ ] In a fixture vault without `areas`, batch mode returns the ready set with an
      explicit unknown-overlap caveat; single-pick output is byte-compatible with
      today's.
- [ ] ship-card on a card whose `touches` overlap an In Progress card surfaces the
      overlap before building; with no overlap, pre-flight adds no noise.
- [ ] Installed copies under `.agents/skills/` are refreshed via the CLI and
      `skills-lock.json` reflects the new versions (T-009).

## Dependencies

- **Depends on:** F-024 (`touches` must exist in spec, core, and this vault's cards).
  **Blocks:** nothing.

## Out of scope

Board/graph UI (F-026), git-diff verification of declarations (future ADR), any change
to the skills' write rules, and editing installed copies by hand (T-009).

## References

[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches);
[`skills/README.md`](../skills/README.md); T-009.
