---
id: T-019
type: task
title: Intent lives in tracked decisions, not comments (ADR + CI guard + sweep)
status: Todo
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [T-017]
touches: [ci, docs]
created: 2026-06-14T20:00:00Z
updated: 2026-06-14T20:00:00Z
---

# T-019 — Intent lives in tracked decisions, not comments (ADR + CI guard + sweep)

The most expensive misjudgment in planning this track came from trusting a stale comment in
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) that promised the validator
*"graduates into core (F-002)"* — a future that never happened once F-002 shipped narrowly.
In an AI-generated repo, **every comment is orphaned the moment it's written**: the agent
that wrote it isn't coming back to update it, and the next agent reads it as authoritative.
Forward-looking comments are therefore guaranteed to rot and actively mislead. This task
makes the rule explicit, enforces it cheaply, and clears existing violations — so the
substrate meets the same cold-read bar the cards already do (ADR-007).

## Outcome

- **ADR-023** records the rule: comments state present mechanics only; forward-looking intent
  ("will," "interim," "for now," "future," "graduates into," `TODO`/`FIXME`) lives behind a
  **card id**, not a bare comment.
- A **CI guard** flags new forward-looking comments that carry no card id and fails the build.
- Existing violations are cleared (the known F-002 comment is T-017's job; this sweeps the
  rest).

## Context — read before starting

- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the F-002 comment that
  triggered this; its fix is owned by **T-017** (the script rewrite). This task depends on
  T-017 so the new guard doesn't flag a comment another card is already removing.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — where ADR-023 is added, in the existing
  ADR format.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — where the guard is wired (a
  grep step or a tiny script).
- [ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents)
  — "the repository is the memory; cards target cold agents." ADR-023 extends that principle
  to the comment layer.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — may gain a one-line pointer to
  ADR-023.

## Constraints (must honor)

- **Target forward-looking comments only**, not all comments. Present-tense mechanism
  comments are good and stay — don't strip useful explanation.
- **Low false-positive guard.** Flag a small, specific marker set; a noisy guard gets
  disabled. Tune against the existing tree so a clean repo passes.
- **Card-id escape hatch.** A forward-looking note is allowed when it carries a card id
  ("interim until F-002" is fine — it points at tracked work). The guard passes when a marker
  is accompanied by a `T-`/`F-` id.
- **Coordinate with T-017** on `scripts/validate-vault.mjs` — it removes the F-002 comment;
  depend on it so this task doesn't fight that edit or double-fix it.

## Plan

1. Write **ADR-023** in `docs/08-DECISIONS.md`: context (AI-generated repo → orphaned
   comments; the F-002 miss), decision (comments = present mechanics; forward-looking → card
   id), consequences (the CI guard; reviewers stop trusting forward-looking comments).
2. Add the CI guard (a grep step in `ci.yml`, or a small `scripts/` checker invoked from CI)
   that fails on a forward-looking marker lacking a nearby card id; document the marker list
   and the escape hatch.
3. Sweep existing comments for violations (excluding the F-002 one T-017 owns); fix each —
   reword to present tense, or attach a card id.
4. Optionally add a one-line pointer to ADR-023 in `docs/09-CONVENTIONS.md`.

## Acceptance

- [ ] ADR-023 exists in `docs/08-DECISIONS.md`, stating the rule and its rationale.
- [ ] CI **fails** when a forward-looking comment lacks a card id and **passes** when one is
      present — a fixture proves both — and the guard is low-false-positive (the existing tree
      passes after the sweep).
- [ ] Existing violations are cleared or carry a card id; the F-002 comment is left to T-017,
      not duplicated here.
- [ ] CI is green with the guard enabled.

## Dependencies

- **Depends on:** T-017 (it removes the F-002 comment the guard would otherwise flag).

## Out of scope

Fixing the F-002 comment itself (T-017), a general doc/comment-staleness linter beyond the
forward-looking marker set, and rewriting present-tense comments.

## References

[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs);
[`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md);
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml);
[ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents);
T-017.
