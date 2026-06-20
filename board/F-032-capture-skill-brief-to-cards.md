---
id: F-032
type: feature
title: Capture skill — turn a brief into well-formed cards (intake)
status: Draft
priority: P3
phase: Future
owner: mozart
dependsOn: [F-014, F-027]
touches: [skills, docs]
created: 2026-06-20T21:15:27Z
updated: 2026-06-20T21:15:27Z
---

# F-032 — Capture skill — turn a brief into well-formed cards (intake)

The skill set covers the *back* of the card lifecycle: `mos-next-card` picks, `mos-ship-card`
builds, `mos-refine-batch` reshapes cards that already exist. Nothing covers the *front* —
turning a raw request or brief into properly-formed cards from scratch. A team adopting mos in
a new repo starts with an empty `board/`, and the first friction is populating it: hand-writing
cards to the cold-start standard (right type, frontmatter in canonical order, `touches`, ids on
the vault's pattern) is exactly the tedious, easy-to-get-wrong work an agent should do. This
card parks a fourth skill — `mos-capture` — that takes a free-text brief and emits cards at the
vault's readiness standard, then hands the result to `mos-refine-batch` for parallel shaping.

**Parked, not ready to ship.** This is a Draft idea, captured so it isn't lost; the Open
questions below must be resolved (a refinement pass) before it's built.

## Why this, and where the boundary sits

- `mos-refine-batch` (F-027) **reshapes existing** initial-state cards — readiness, `touches`,
  splitting overlap clusters. It assumes cards already exist.
- `mos-capture` **creates** cards from a brief where none exist. It is the intake step that
  *produces* the cards refine-batch later shapes.
- The clean division: capture turns prose → a set of cards; refine-batch turns a set of cards →
  a parallel-safe set. Capture should **not** reshape or compute batches — it hands off.

## Outcome (sketch — firm up at refinement)

- A new installable skill `skills/mos-capture` in the standard layout
  ([`skills/README.md`](../skills/README.md)): config-driven, vault-agnostic, refuses to run
  without a `.mos/config.json` — same posture as its three siblings.
- Given a brief (a paragraph, a bullet list, a pasted issue), it proposes a set of cards with:
  the correct `type`(s) from config, ids following the vault's `references.idPattern`,
  frontmatter in canonical field order with `created`/`updated`, and `touches` inferred from
  the repo layout (F-024 areas) where determinable.
- Each proposed card meets the cold-start readiness standard (Outcome / Context / Constraints /
  Plan / Acceptance / Out of scope) — the same bar `mos-refine-batch` raises cards to.
- Writes the cards only on explicit confirmation; then points the user at `mos-refine-batch`
  for parallel shaping rather than doing it itself.
- Degrades honestly: no `areas` → it still drafts cards but leaves `touches` empty and says so.

## Context — read before starting

- [F-027](F-027-refine-batch-skill.md) — the sibling that owns the readiness standard and the
  reshape/parallel logic; `mos-capture` produces cards *to* that standard and stops at the
  boundary (no reshaping). Read it to keep the two skills from overlapping.
- [`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md),
  [`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md),
  [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md) — match their
  structure, config handling, and refusal behavior; reuse the config-loading helper pattern.
- [`skills/README.md`](../skills/README.md) — authoring rules (vault-generic, config-driven,
  zero-dep Python, `mos-` prefix) and the authored-vs-installed relationship.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — card readiness standard, id rules,
  timestamps, canonical field order (the contract the emitted cards must satisfy).
- F-014 — portable agent skills (the installable layout this follows); F-024 — areas/`touches`
  (what intake infers); T-009 — installed copies are refreshed via the CLI, never hand-edited.

## Constraints (must honor)

- **Config-driven, vault-agnostic** — types, states, id pattern, areas all come from the
  target's `.mos/config.json`; nothing assumes this repo's `F-`/`T-` vocabulary.
- **Stay on the intake side of the boundary** — capture creates new cards; it does not reshape,
  split, or compute parallel batches (that is `mos-refine-batch`). It hands off.
- **Emitted cards meet the readiness standard** and the write conventions: canonical field
  order, `created`/`updated` set, ids on the vault's pattern and never reused.
- **Explicit invocation and explicit confirmation** before any file is written; capture never
  runs as a side effect of another skill.
- **Never write app/vault code** — it writes cards under `board/` only.

## Open questions (resolve at refinement)

- Decomposition depth: does a brief yield one card, or a parent + children (epic → stories)?
  How does it decide when to split vs. keep flat?
- Type selection: how does it choose `feature` vs `task` (vs any custom type) from prose?
- Does it set `dependsOn` between the cards it creates, or leave all edge-drawing to
  `mos-refine-batch`?
- One-shot vs interactive (confirm each card vs. propose the whole set then write)?

## Acceptance (provisional)

- [ ] `skills/mos-capture` exists in the installable layout, is config-driven, and refuses to
      start without `.mos/config.json` — same behavior as its siblings.
- [ ] Given a brief in a fixture vault with foreign vocabulary, it proposes cards using that
      vault's types, id pattern, and canonical field order — not this repo's vocabulary.
- [ ] Proposed cards meet the cold-start readiness standard and have `touches` inferred where
      `areas` exist (empty + flagged where they don't).
- [ ] It writes cards only on confirmation and defers reshaping/batching to `mos-refine-batch`.
- [ ] Installed copies refreshed via the CLI with `skills-lock.json` updated (T-009); an eval
      scenario covers the brief → cards path.

## Dependencies

- **Depends on:** F-014 (portable skill layout), F-027 (the readiness standard its output must
  meet; the intake/refine boundary). **Blocks:** nothing.

## Out of scope

Reshaping, splitting, or computing parallel batches (F-027 `mos-refine-batch`); picking
(`mos-next-card`); shipping (`mos-ship-card`); any board UI; importing from external trackers
(a separate, later idea).

## References

[F-027](F-027-refine-batch-skill.md); [`skills/README.md`](../skills/README.md);
[`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md); F-014; F-024; T-009.
