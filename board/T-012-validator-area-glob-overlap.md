---
id: T-012
type: task
title: Validator — flag overlapping area globs
status: Todo
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [T-011]
touches: [scripts]
created: 2026-06-13T17:50:00Z
updated: 2026-06-13T17:50:00Z
---

# T-012 — Validator — flag overlapping area globs

[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c says areas must be
*non-overlapping* — "two differently-named areas whose globs match the same file defeat
the point" — but nothing checks it: [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs)
validates that `touches` names a real area and warns on in-flight overlap, yet never
looks at the area definitions themselves. A vault can quietly define `web` and `app`
that both match `apps/web/**`, and the batch math silently mis-attributes collisions.
This adds the one cheap, deterministic check that catches it.

## Outcome

- The validator warns when two area definitions match a common file — naming the two
  areas and a sample shared path. It is the *glob-overlap* check only: a mechanical
  "these two names claim the same file" signal, not a judgment about whether an area is
  well-sized (granularity isn't statically decidable — that stays a planning call, per
  §5c).
- Empty `areas`, or areas that are genuinely disjoint, produce no warning. A vault with
  no `areas` is unaffected.
- The check ships with tests under the harness T-011 establishes, so it can't silently
  regress (the failure mode PR #49's review kept catching).

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c — the non-overlap rule this
  enforces, and the explicit non-goal (granularity is not mechanical).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the area/touches block
  (the unknown-area error and in-flight overlap warning) this sits beside.
- T-011 — the validator test suite this check's tests belong to; land on top of it.
- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  — why area disjointness is load-bearing for batch planning.

## Constraints (must honor)

- **Keep it simple and honest.** Flag only demonstrable overlap (a shared matched file);
  do not attempt to score coarseness or guess intent. A false "too coarse" warning is
  worse than none.
- **Warning, not error.** Overlap is a design smell, not a broken vault — don't fail the
  build on it (consistent with the in-flight overlap warning already there).
- **Additive:** a vault with no `areas` and vaults whose areas are disjoint stay
  warning-free; no change to exit codes for existing clean vaults.
- **Lands with tests** (T-011): the new rule gets fixtures proving overlap is caught and
  disjoint/empty configs are not.

## Plan

1. After config load, expand each area's globs against the vault's file list (the
   validator already enumerates files) and detect any file matched by two area names.
2. Emit one warning per overlapping pair: the two names + a sample shared path; collapse
   duplicates so a many-file overlap is one line.
3. Add fixtures/tests under T-011's suite: an overlapping pair warns; disjoint areas and
   a no-`areas` vault stay clean.
4. `bun run validate` on this repo stays clean (its areas are already disjoint).

## Acceptance

- [ ] A config with two areas whose globs match a shared file produces a warning naming
      both areas and a sample path; a many-file overlap is one line, not N.
- [ ] Disjoint areas, and a vault with no `areas`, produce no new warning and the same
      exit code as before.
- [ ] This repo validates with no new warnings.
- [ ] The behavior is covered by tests in the validator suite (T-011), failing the build
      on regression.

## Dependencies

- **Depends on:** T-011 (the validator test suite — so this rule lands tested, not
  smoke-checked). Both touch `scripts`, so they are sequenced, not parallel.

## Out of scope

Scoring area granularity or coarseness, any hub/module awareness (that's a planning
judgment, not a validator rule), git-diff verification of `touches` against actual
changes (future ADR, ADR-021), and changing the in-flight overlap warning.

## References

[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c;
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs); T-011.
