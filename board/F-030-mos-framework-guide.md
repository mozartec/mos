---
id: F-030
type: feature
title: Ship the mos framework guide (.mos/AGENTS.md), scaffolded by mos init
status: Done
priority: P1
phase: Phase 4
owner: mozart
touches: [config, cli, docs]
created: 2026-06-14T20:00:00Z
updated: 2026-06-20T12:00:00Z
---

# F-030 — Ship the mos framework guide (.mos/AGENTS.md), scaffolded by mos init

Today the only thing that explains "how mos works" is this repo's `docs/` — ADRs,
`05-VAULT_SPEC.md`, `09-CONVENTIONS.md` — **none of which exist in an adopter repo**. So the
skills can't point at a shared explanation, and a cold agent in any other mos vault has no
manual. This feature ships a **portable framework guide** at `.mos/AGENTS.md`, scaffolded by
`mos init` and referenced from the host repo's root `AGENTS.md`. It is the canonical,
repo-agnostic answer to "what is mos and how do I operate this vault."

## Outcome

- `mos init` writes `.mos/AGENTS.md` — a concise, portable guide to operating a mos vault:
  the lenses (board / wiki / graph), what a card / type / state / column is, the
  config-driven rule, areas & `touches`, parallel batches, the write conventions
  (frontmatter-only on decided cards, timestamps UTC, ids never reused), and a **Versioning**
  section (the spec / CLI / skills axes and how they relate).
- The scaffolded host root `AGENTS.md` references `.mos/AGENTS.md` as the framework manual.
- **One canonical home:** the guide owns "how to operate a vault"; `05-VAULT_SPEC.md` stays
  the formal format contract. The guide points at the spec, not the reverse — so they don't
  fork into two drifting truths (the bottleneck that produced the stale F-002 comment).
- This repo dogfoods it: its own `.mos/AGENTS.md` exists and root `AGENTS.md` references it;
  repo-specific quirks (e.g. why skills are duplicated into `.agents/`) stay in root
  `AGENTS.md`, **not** the portable guide.

## Context — read before starting

- [`apps/cli/src/init.ts`](../apps/cli/src/init.ts) — the scaffolder (it already writes
  `.mos/config.json`, `AGENTS.md`, sample cards); the `.mos/AGENTS.md` template is added
  here.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) and
  [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — the source material to **distill**
  (not copy wholesale): the portable subset an adopter needs, minus this repo's ADR history.
- [`AGENTS.md`](../AGENTS.md) (root) — gains a reference to `.mos/AGENTS.md`; keeps the
  this-repo-only content (dogfooding, the `.agents/` ↔ `.claude/` ↔ `skills/` topology).
- F-014 (portable agent skills), F-016 (vault init) — the portability + init machinery this
  builds on.
- [ADR-013](../docs/08-DECISIONS.md#adr-013--scaffolding-is-not-a-runtime-write) — writing
  `.mos/AGENTS.md` at init time is a one-time scaffold write, not a runtime write (ADR-002
  still holds: the app never rewrites it).

## Constraints (must honor)

- **Portable, not repo-specific.** The guide describes mos for *any* vault — no reference to
  this repo's ADRs, packages, or the `.agents/`/`.claude/` dogfooding setup. If a sentence
  only makes sense here, it belongs in root `AGENTS.md`, not the guide.
- **One canonical home (don't recreate the duplication bottleneck).** The guide is THE source
  for "how to operate"; it links to `05-VAULT_SPEC.md` for the formal contract rather than
  restating it, and states the spec version it targets.
- **Distill, don't dump.** It's a short operator's manual a cold mid-tier agent reads once —
  not a re-paste of `VAULT_SPEC`. Every line earns its place (the SKILL.md bar).
- **Not a skill dependency.** Skills stay self-contained (they gate on `.mos/config.json`
  only); the guide is additive context they *may* reference but never require — hand-made or
  older-`init` vaults won't have it (see T-018).

## Plan

1. Draft the `.mos/AGENTS.md` content: lenses; card = folder scope + recognized type; config
   drives types/states/columns; areas & `touches`; parallel = pairwise-disjoint `touches`;
   write rules (frontmatter-only on decided cards, UTC timestamps, ids never reused); a
   Versioning section (spec = format contract; CLI = tool that *states the spec range it
   supports*; skills = self-contained, require only config); a pointer to `VAULT_SPEC` for
   the formal contract.
2. Add it to the init scaffolder so `mos init` writes `.mos/AGENTS.md`, and the scaffolded
   root `AGENTS.md` references it.
3. Dogfood: create this repo's own `.mos/AGENTS.md` and reference it from root `AGENTS.md`;
   move nothing repo-specific into the guide (the skills-duplication explanation stays in
   root `AGENTS.md`).
4. Make canonicality explicit: a one-line note in `VAULT_SPEC` §0 ("operational guide:
   `.mos/AGENTS.md`; this doc is the formal contract") and the reciprocal pointer in the
   guide.
5. Validate: `mos validate` / `bun run validate` clean; `mos init` in a temp dir produces a
   vault whose `.mos/AGENTS.md` exists and reads coherently cold.

## Acceptance

- [x] `mos init <dir>` produces `<dir>/.mos/AGENTS.md`, and the scaffolded root `AGENTS.md`
      references it.
- [x] The guide is fully portable — no reference to this repo's ADRs/packages/dogfooding; a
      cold agent in a fresh vault can operate from it plus the config.
- [x] It includes a Versioning section covering the spec / CLI / skills axes and how they
      relate.
- [x] Canonicality is explicit: the guide owns "how to operate," `VAULT_SPEC` owns the formal
      contract, each points at the other — no duplicated source of truth.
- [x] This repo dogfoods it (`.mos/AGENTS.md` present, root `AGENTS.md` references it,
      repo-specific content stays in root).
- [x] The repo validates clean.

## Dependencies

- **Depends on:** nothing (foundational). **Relates to:** T-018 — skills may *optionally*
  reference the guide, but must not depend on it.

## Out of scope

Making skills depend on the guide (they stay self-contained — T-018); the comment-hygiene
rule (T-019); and auto-generating/syncing the guide from `VAULT_SPEC` (manual for now — the
canonicality note is what prevents drift).

## References

[`apps/cli/src/init.ts`](../apps/cli/src/init.ts);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md);
[`AGENTS.md`](../AGENTS.md);
[ADR-013](../docs/08-DECISIONS.md#adr-013--scaffolding-is-not-a-runtime-write);
F-014; F-016; T-018.
