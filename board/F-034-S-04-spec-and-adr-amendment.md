---
id: F-034-S-04
type: story
title: Docs — laneField spec & ADR amending ADR-019
status: Todo
priority: P2
owner: mozart
parent: F-034
estimate: XS
touches: [docs]
created: 2026-07-03T11:00:00Z
updated: 2026-07-03T11:00:00Z
---

# F-034-S-04 — Docs: laneField spec & ADR amending ADR-019

Record the new mechanism where the framework documents its decisions: the `board.laneField`
config key in the vault spec, and an ADR that amends ADR-019 to say containers now surface as
lane headers on the board (not only in the list views), while still never occupying a column.

## Outcome

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) documents `board.laneField` alongside
  `board.columns`/`scopeField`/`sortWithinColumn`: optional; absent ⇒ single flat lane; the
  literal `"parent"` ⇒ data-derived container lanes with a computed-progress header; any other
  value ⇒ a registered field's values. States that the flat board is the default and that lanes
  are presentational (read-only).
- A new ADR (next free number) in [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) **amends
  ADR-019**: containers still never occupy board columns (their status is a computed rollup),
  but under `laneField: "parent"` they render as **lane headers** on the board rather than being
  visible only in the list views. Records why this preserves ADR-019's intent (progress
  computed, not asserted) and notes the two-altitude ceiling (a 3-deep tree is future work).
- A pointer from [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md) (board/lens vocabulary) to the
  new lane concept, and from [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) if the board
  section references container placement.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — §6 (`config.json`, where board keys are
  documented) and the board section; follow how `scopeField` is written up (F-028/ADR-020).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — the ADR log; add after the current last
  ADR (confirm the next free number — F-033 already added one after ADR-023). ADR-019 is the
  one being amended; ADR-020 (scope) and F-028 are the additive-opt-in precedent to cite.
- [`docs/02-CONCEPTS.md`](../docs/02-CONCEPTS.md), [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md)
  — the concept/convention text to cross-link.
- [F-034](F-034-swimlanes-group-by-parent-lanes.md) — the feature this documents; keep the spec
  wording consistent with what S-01/S-02 actually shipped.

## Constraints (must honor)

- **Docs match the shipped behavior:** write the spec/ADR against what S-01–S-03 implemented,
  not the proposal; if they diverged, the docs follow the code.
- **Amend, don't silently overturn:** the ADR explicitly references ADR-019 and states what
  changes and what stays true.
- **Timestamps** per [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) (UTC `…Z`).

## Plan

1. Add `board.laneField` to VAULT_SPEC §6 + the board section (flat = default; `"parent"` and
   field modes; presentational/read-only).
2. Add the ADR amending ADR-019 (next free number); cite ADR-020/F-028 precedent; note the
   two-altitude ceiling.
3. Cross-link from CONCEPTS (and CONVENTIONS if it mentions container placement).

## Acceptance

- [ ] `board.laneField` is documented in VAULT_SPEC (default flat; `"parent"` + field modes;
      read-only/presentational), consistent with the shipped code.
- [ ] A new ADR amends ADR-019 (containers as lane headers on the board, still never in a
      column), cites the ADR-020/F-028 opt-in precedent, and records the two-altitude ceiling.
- [ ] CONCEPTS (and CONVENTIONS if relevant) link to the lane concept; `bun run validate` green.

## Dependencies

- **Depends on:** — (can be drafted alongside S-01/S-02, but finalize *after* S-02 so the docs
  describe the shipped mechanism). **Blocks:** —

## Out of scope

Any code (core/web) — that's S-01–S-03. This story is docs + the ADR only.

## References

F-034, F-034-S-01, F-034-S-02; [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md); [ADR-019](../docs/08-DECISIONS.md),
[ADR-020](../docs/08-DECISIONS.md); F-028.
