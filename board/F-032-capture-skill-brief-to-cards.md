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
updated: 2026-06-21T13:08:35Z
---

# F-032 — Capture skill — turn a brief into well-formed cards (intake)

The skill set covers the *back* of the card lifecycle: `mos-next-card` picks, `mos-ship-card`
builds, `mos-refine-batch` reshapes cards that already exist. Nothing covers the *front* —
turning a raw request or brief into properly-formed cards from scratch. A team adopting mos in
a new repo starts with an empty `board/`, and the first friction is populating it: hand-writing
cards to the cold-start standard (right type, frontmatter in canonical order, `touches`, ids on
the vault's pattern) is exactly the tedious, easy-to-get-wrong work an agent should do. This
card adds a fourth skill — `mos-capture` — that takes a free-text brief and emits cards at the
vault's readiness standard, then hands the result to `mos-refine-batch` for parallel shaping.

Capture spans the **whole range** of how cards get born: a small bug found mid-work to fix
"not today", a task to repair broken CI or add a validation, a card or two that fall out of a
discussion, or a large initiative captured as one container to be split later. The skill's job
is to land each at the **right type and level** for the vault — never to assume what those are.

## Why this, and where the boundary sits

- `mos-refine-batch` (F-027) **reshapes existing** initial-state cards — readiness, `touches`,
  splitting overlap clusters, parallel batches. It assumes cards already exist.
- `mos-capture` **creates** cards from a brief where none exist. It is the intake step that
  *produces* the cards refine-batch later shapes.
- The clean division: capture turns prose → a set of cards; refine-batch turns a set of cards →
  a parallel-safe set. Capture should **not** reshape, split, compute batches, or infer
  surface-driven dependencies — it hands off.

## Outcome

- A new installable skill `skills/mos-capture` in the standard layout
  ([`skills/README.md`](../skills/README.md)): config-driven, vault-agnostic, refuses to run
  without a `.mos/config.json` — same posture as its three siblings.
- Given a brief (a paragraph, a bullet list, a pasted issue), it proposes a set of cards with:
  the right `type` **chosen from the vault's own type system** (see Decisions), ids following
  the vault's `references.idPattern`, frontmatter in canonical field order with
  `created`/`updated`, and `touches` inferred from the repo layout (F-024 areas) where
  determinable.
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

- **Types are config-derived, never hardcoded.** No built-in `feature`/`task` (or any)
  vocabulary or "feature vs task" rule — the same skill must work unchanged on a vault whose
  types are `epic`/`story`/`task`, or anything else. Type, hierarchy, states, id pattern, and
  field order all come from the target `.mos/config.json`.
- **Stay on the intake side of the boundary** — capture creates new cards; it does not reshape,
  split, compute parallel batches, or infer surface-driven `dependsOn` (that is
  `mos-refine-batch`). It hands off.
- **Emitted cards meet the readiness standard** and the write conventions: canonical field
  order, `created`/`updated` set, ids on the vault's pattern and never reused.
- **Explicit invocation and explicit confirmation** before any file is written; capture never
  runs as a side effect of another skill.
- **Never write app/vault code** — it writes cards under `board/` only.

## Decisions (resolved at refinement)

1. **Type & level — from the brief's scope, mapped onto config's types.** Capture reads the
   vault's declared types and their hierarchy (which type is a container — `parent: null` with
   others pointing to it — and which are leaves/standalone) and lands the brief at the matching
   level: a single, small unit of work (a bug to fix later, a CI repair, a validation to add)
   → the smallest standalone work type; a large initiative → the container type. It hardcodes
   no type names. When the brief doesn't disambiguate the level, it asks or defaults and flags
   the choice.
2. **Decomposition depth — pick the level, don't over-fan-out.** Capture creates at the level
   the brief warrants and stops. One shippable unit → one card. A brief that *clearly* holds
   several units under one goal → a container plus the children explicit in the brief. A large
   epic whose breakdown isn't decided yet → **the container alone**, left for later splitting
   (refine, or a follow-up). Capture biases to the flattest faithful representation; deep
   decomposition into stories is refine's / human planning's job, not capture's.
3. **`dependsOn` — only what's stated or structural.** Capture sets `parent:` for any
   container/child it creates, and `dependsOn` only for edges **explicit in the brief** ("do X
   before Y"). It never infers `dependsOn` from `touches`/area overlap — that surface-driven
   sequencing is `mos-refine-batch`'s. Capture records intent; refine computes collisions.
4. **Flow — propose the whole set, write on one confirmation.** Capture drafts the full set,
   shows it, and writes only on explicit confirmation; a short clarifying question only when
   the type/level or decomposition is genuinely ambiguous. No per-card interrogation.

(`touches`: best-effort from the area globs where confidently determinable; otherwise left off
and flagged — refine's pass-2 owns getting it right.)

## Plan

1. Scaffold `skills/mos-capture/` in the installable layout — SKILL.md plus a zero-dependency
   Python helper that mirrors the siblings' config-loading and the refuse-without-`.mos/config.json`
   gate.
2. Read side: load the target config — types + hierarchy, `references.idPattern`, `areas`,
   canonical field order, per-type initial state — reusing the shared loader; hardcode nothing.
3. Intake: brief → a proposed card set, choosing type/level per the Decisions, ids on the
   vault's pattern, frontmatter in canonical order with `created`/`updated`, readiness sections
   filled from the brief, best-effort `touches`.
4. Confirm → write under `board/` only; then point the user at `mos-refine-batch` for parallel
   shaping (capture does none).
5. Eval: a scenario in a fixture vault with foreign vocabulary, asserting the brief → cards path
   uses that vault's types/id-pattern/field-order and spans both a single-task brief and a
   multi-card / container brief; cold run per [`skills/evals/README.md`](../skills/evals/README.md).
6. Regenerate installed copies + `skills-lock.json` (T-009 flow); `.claude/skills/*` stay
   symlinks. Validate the repo.

## Acceptance

- [ ] `skills/mos-capture` exists in the installable layout, is config-driven, and refuses to
      start without `.mos/config.json` — same behavior as its siblings.
- [ ] Given a brief in a fixture vault with foreign vocabulary, it proposes cards using that
      vault's types, hierarchy, id pattern, and canonical field order — choosing the type/level
      from the brief's scope, with no hardcoded `feature`/`task` (or any) rule.
- [ ] It spans the range: a single small brief → one card of the right standalone type; a large
      brief → a container (left unsplit) or container + explicit children; a couple of asks →
      a couple of cards.
- [ ] Proposed cards meet the cold-start readiness standard, with `touches` inferred where
      `areas` make it determinable and left empty + flagged where they don't.
- [ ] `dependsOn` is set only from explicit brief order or created structure; reshaping,
      splitting, and parallel batches are deferred to `mos-refine-batch`.
- [ ] It writes cards only on confirmation, under `board/` only; installed copies +
      `skills-lock.json` regenerated (T-009); an eval covers the brief → cards path; the repo
      validates.

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
