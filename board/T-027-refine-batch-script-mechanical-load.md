---
id: T-027
type: task
title: refine-batch script carries more mechanical load, generically, at scale
status: Todo
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [F-027]
touches: [skills]
created: 2026-06-21T10:08:13Z
updated: 2026-06-21T10:08:13Z
---

# T-027 — refine-batch script carries more mechanical load, generically, at scale

`mos-refine-batch`'s script (`refine_batch.py`) today reports refinable cards, missing
sections, `touches` state, and **raw** overlap clusters; the judgement — which clusters are
real, the conflict-free batch, the canonical field order to emit — is left to the agent. On
a small, well-groomed board that's fine. On a large vault (hundreds of cards) operated by a
weak model that isn't fully focused, that reasoning is exactly the context-exhausting,
error-prone part the script should own. This task moves the mechanical work into the script
— staying vault-generic (reads only the target `.mos/config.json` and its cards; hardcodes
no area names, types, or states) — and calibrates the SKILL's reshape guidance to the
*shape* of a vault's areas.

## Why this matters across vaults, not just here

- The skill's hub-vs-module / schema-and-wiring-leaf machinery is built for **fine-grained
  semantic areas** — areas mapped to hub files (a composition/DI root, a migrations
  snapshot, a route manifest, a permission catalog) plus per-module surfaces. There it is
  load-bearing: hubs are isolatable, modules batch freely.
- This repo's own areas are **coarse** — roughly one per top-level package/dir — so any two
  cards sharing an area collide by construction and reshaping can't help. The dogfood vault
  under-exercises the logic the skill exists for. An agent should neither apply the heavy
  reshape reasoning to a coarse-area vault nor skip it on a fine-grained one; the script and
  guidance should make that calibration explicit instead of leaving it to be (mis)judged.

## Outcome

- `refine_batch.py` additionally emits, computed from `status` + `dependsOn` + `touches`
  (all already on the cards):
  - the **ready set** — every dependency Done, not parked/blocked — within the horizon;
  - **overlap clusters filtered to ready cards** — collisions among cards that could
    actually run now, not blocked/parked/future-phase noise;
  - a **candidate conflict-free batch** — a maximal set of ready cards with pairwise-disjoint
    `touches` (the same semantics `mos-next-card --parallel` computes), so the agent confirms
    a batch rather than deriving one;
  - an **area fan-in** count — how many ready cards touch each area — surfacing the
    serialization bottlenecks (de-facto hubs) empirically, without reading code or new config.
- The script emits the **canonical frontmatter field order per type**, read from the target
  config (`fieldOrder` when present, else the documented default) intersected with each
  type's `card.fields` plus the required fields — so a writer generating many cards never
  re-derives it, and a vault that sets `fieldOrder` (unlike this one) gets the right order.
- The SKILL gains a short **calibration rule**: fine-grained semantic areas (hubs + module
  seams) → apply the full hub-vs-module reasoning; coarse, top-level-directory areas → cards
  sharing an area are serial by construction, so don't manufacture reshapes. Keyed on the
  shape of the areas, never on any project.

## Context — read before starting

- [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md) — the three
  passes, hub-vs-module, schema-and-wiring-leaf; add the calibration rule and point Pass 3 at
  the new script outputs.
- [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
  — the pre-compute to extend; keep it zero-dependency stdlib Python and config-driven (no
  hardcoded area/type/state names).
- [`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md) — its `--parallel` mode
  already computes conflict-free batches; mirror its semantics (pairwise-disjoint `touches`
  over the ready set) so the two skills agree. Don't fork the meaning of "ready" or
  "conflict-free".
- [`skills/evals/refine-fixture-vault/`](../skills/evals/refine-fixture-vault/) — its areas
  are a hub (`registry`) plus modules (`flights`/`hotels`/`cars`/`guide`) and it sets
  `fieldOrder`, so it already exercises both the hub-concentration path and a non-default
  field order — the new outputs are testable there without a new fixture.
- [`skills/README.md`](../skills/README.md) — authoring rules (vault-generic, config-driven,
  zero-dep Python).
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — the canonical field order and
  readiness standard the emitted order must match.

## Constraints (must honor)

- **Vault-generic (F-014, ADR-003).** Every new output derives from the target's
  `.mos/config.json` and its cards; no area name, type, state, or id scheme is hardcoded. It
  must produce correct results on a vault whose areas, types, states, and field order differ
  entirely from this one.
- **Zero-dependency Python.** Stdlib only, as today; degrade gracefully when Python is absent
  (the SKILL already carries a manual fallback).
- **No format/spec change.** Fan-in and the batch are computed from existing fields; this
  card adds no config keys. Declaring hub areas in config is a separate decision — see Out of
  scope.
- **Advisory, not gating.** The computed batch is a proposal the agent confirms; refinement
  still proposes-then-applies on confirmation.
- **Don't fork "ready"/"conflict-free".** Reuse `mos-next-card`'s `--parallel` semantics.

## Plan

1. Extend `refine_batch.py`: ready-set, ready-filtered clusters, candidate conflict-free
   batch (maximal pairwise-disjoint `touches` over the ready set), and per-area fan-in —
   added to the existing `--json` shape, additively (don't break current consumers).
2. Emit the canonical field order per type (`fieldOrder` | default ∩ `card.fields` + required)
   in the script output.
3. `SKILL.md`: add the area-shape calibration rule; point Pass 3 at the ready-filtered
   clusters + candidate batch + fan-in instead of raw clusters; keep the "degrade honestly"
   rule.
4. Eval: extend the refine scenario to assert the script proposes a correct conflict-free
   batch and honors the fixture's non-default field order; run cold per
   [`skills/evals/README.md`](../skills/evals/README.md).
5. Regenerate installed copies + `skills-lock.json` (T-009 flow); `.claude/skills/*` stay
   symlinks. Validate this repo.

## Acceptance

- [ ] `refine_batch.py --json` additionally emits: the ready set, ready-filtered overlap
      clusters, a candidate conflict-free batch (pairwise-disjoint `touches` over ready cards,
      matching `mos-next-card --parallel` semantics), and per-area fan-in — all derived from
      existing card fields, hardcoding no area/type/state names.
- [ ] The script emits the canonical field order per type read from the target config
      (`fieldOrder` when set, else the default) — correct on a vault whose order is non-default.
- [ ] `SKILL.md` states the area-shape calibration rule (fine-grained hubs+modules → full
      reshape reasoning; coarse top-level-dir areas → serial-by-construction, don't reshape),
      and Pass 3 consumes the new outputs.
- [ ] The refine eval exercises the candidate-batch and field-order outputs against the
      existing hub+module fixture, cold; installed copies + `skills-lock.json` regenerated and
      byte-matching; this repo validates clean.

## Dependencies

- **Depends on:** F-027 (the refine-batch skill these extend). **Related:** T-024 (verifies
  the skills cold; same `skills` area — sequence either order, not a logical dependency).
  **Blocks:** nothing.

## Out of scope

- **Config-declared hub areas** (e.g. a `board.hubAreas` list) so hub concentration becomes
  mechanical rather than empirical — a format addition warranting its own card and possibly an
  ADR (cf. how config-named in-flight columns are handled in F-028). This card stays
  format-free; fan-in surfaces hubs empirically instead.
- Changes to `mos-next-card` / `mos-ship-card` beyond matching `--parallel`'s batch semantics;
  a capture/intake skill (F-032); any board UI.
- New validation rules or report formats.

## References

[`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md);
[`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py);
[`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md);
[`skills/evals/refine-fixture-vault/`](../skills/evals/refine-fixture-vault/);
[`skills/README.md`](../skills/README.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md); F-027; F-014.
