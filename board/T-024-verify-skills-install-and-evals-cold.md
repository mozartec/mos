---
id: T-024
type: task
title: Verify the mos skills install clean and pass their evals cold before the next adoption
status: Todo
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [T-018]
touches: [skills]
created: 2026-06-20T21:15:27Z
updated: 2026-06-20T21:15:27Z
---

# T-024 — Verify the mos skills install clean and pass their evals cold before the next adoption

The three first-party skills — `mos-next-card`, `mos-ship-card`, `mos-refine-batch` — are how
an agent operates a vault in the next project. They were just made self-contained (T-018), but
"self-contained" was a code review, not an execution: we haven't freshly run the eval suites or
rehearsed a from-scratch install since. This task is the verification gate before we rely on
them elsewhere: every eval scenario passes against its fixture vault on a cold (weak-model,
no-network, no-`gh`) run, and `npx skills add mozartec/mos` produces a clean install whose
copies match source and whose lock entries carry the canonical `mozartec/mos` source. Anything
that fails is fixed in `skills/` and the installed copies regenerated — never hand-edited.

## Outcome

- Every eval in `skills/*/evals/evals.json` is run against its fixture per
  [`skills/evals/README.md`](../skills/evals/README.md) and judged against its `assertions`;
  results recorded (pass/fail per scenario) in the PR body.
- Any failing scenario is fixed by editing the **authored** skill under `skills/` (SKILL.md or
  bundled Python), then the installed copies + `skills-lock.json` are regenerated (T-009 flow);
  behavior, not methodology, is what's corrected.
- A cold install is rehearsed: from a disposable dir, the `skills` CLI install of the three mos
  skills yields copies that byte-match `skills/`, with `skills-lock.json` `source` =
  `mozartec/mos` / `sourceType` = `github`.
- The skills name no tool an adopter repo lacks except the mos CLI (the T-018 guarantee
  re-confirmed by `grep`), and this repo still validates clean.

## Context — read before starting

- [`skills/evals/README.md`](../skills/evals/README.md) — the run procedure: copy a fixture to
  a temp repo, install the relevant skills under `.agents/skills/`, `git init`, run a fresh
  small-model agent with the eval's `prompt`, judge the transcript against `assertions`. Lists
  the special setups (`not-a-vault-refusal`, `harness-branch-stay`, `parallel-batch-no-areas`,
  `no-areas-degrade`) — honor each exactly.
- [`skills/evals/fixture-vault/`](../skills/evals/fixture-vault/) — the pick/ship fixture
  (foreign vocabulary: epic/job, Queued/Doing/Shipped) for `mos-next-card` + `mos-ship-card`.
- [`skills/evals/refine-fixture-vault/`](../skills/evals/refine-fixture-vault/) — the
  refinement fixture (track/leg/errand) for `mos-refine-batch`; reshapes cards, so the agent
  must be told to apply changes.
- [`skills/mos-next-card/evals/evals.json`](../skills/mos-next-card/evals/evals.json),
  [`skills/mos-ship-card/evals/evals.json`](../skills/mos-ship-card/evals/evals.json),
  [`skills/mos-refine-batch/evals/evals.json`](../skills/mos-refine-batch/evals/evals.json) —
  the scenarios to run.
- [`skills/README.md`](../skills/README.md) — authoring rules (vault-generic, config-driven,
  zero-dep Python) and the authored-vs-installed relationship; the install command is
  `npx skills add mozartec/mos`.
- [`skills-lock.json`](../skills-lock.json) — the lock; the three mos entries must read
  `source: "mozartec/mos"`, `sourceType: "github"`.
- T-018 — made the skills self-contained (only the mos CLI may be named); re-verify, don't
  redo. T-009 — the install/regeneration procedure (CLI local-path `--copy`, normalize the
  lock `source`, `.claude/skills/*` stay symlinks into `.agents/skills/`).

## Constraints (must honor)

- **Skills stay vault-generic (F-014, ADR-003)** — any fix reads vocabulary from the target's
  `.mos/config.json`; nothing mos-repo-specific gets hardcoded.
- **Evals run cold** — fresh agent (ideally a weak model), no network, `gh` treated as absent;
  judge only against the recorded `assertions`. Don't loosen an assertion to make it pass.
- **Evals run against fixtures, never this repo's live board** — the live board moves and would
  rot the evals.
- **Never hand-edit the installed copies** (`.agents/skills/mos-*`) — change `skills/` and
  reinstall; `.claude/skills/*` remain symlinks (T-009).
- **Only the mos CLI may be named** as an external tool in the shipped surface (T-018) — the
  `grep` guard stays clean.
- **Bump `updated`** on this card when ticking its Acceptance boxes; no other prose edits.

## Plan

1. For each skill, run every `evals.json` scenario per `skills/evals/README.md` (including the
   special setups); record pass/fail per scenario.
2. For each failure, fix the authored skill under `skills/` (SKILL.md or its Python), keeping
   methodology intact; re-run that scenario to green.
3. If any skill changed, regenerate `.agents/skills/mos-*` + `skills-lock.json` via the T-009
   flow; confirm installed copies byte-match source and `.claude/skills/*` are still symlinks.
4. Rehearse a cold install in a disposable dir and confirm the produced copies + lock
   (`source: mozartec/mos`, `sourceType: github`).
5. Re-run the T-018 guard
   (`grep -rE 'ADR-|VAULT_SPEC|bun run|scripts/validate|\.mjs' skills/*/SKILL.md skills/*/scripts/*.py`
   returns nothing) and validate this repo.

## Acceptance

- [ ] Every `evals.json` scenario for all three skills passes against its fixture on a cold,
      no-network, no-`gh` run; pass/fail per scenario recorded in the PR body.
- [ ] Any fix was made in `skills/` (not the installed copies) and preserved skill methodology;
      `.agents/skills/mos-*` + `skills-lock.json` regenerated and byte-matching, `.claude/skills/*`
      still symlinks.
- [ ] A from-scratch install produces the three skills with `skills-lock.json` `source` =
      `mozartec/mos`, `sourceType` = `github`.
- [ ] The T-018 grep guard returns nothing (only the mos CLI is named); `bun run validate` is
      clean.

## Dependencies

- **Depends on:** T-018 (the self-contained skill surface this verifies). **Blocks:** nothing.

## Out of scope

New skills or new eval scenarios (this verifies the existing three); changing skill methodology
(only behavior corrections that make a recorded assertion pass); the CLI smoke/guide (T-023);
the human adoption docs (T-025).

## References

[`skills/evals/README.md`](../skills/evals/README.md); [`skills/README.md`](../skills/README.md);
[`skills/mos-next-card/evals/evals.json`](../skills/mos-next-card/evals/evals.json);
[`skills/mos-ship-card/evals/evals.json`](../skills/mos-ship-card/evals/evals.json);
[`skills/mos-refine-batch/evals/evals.json`](../skills/mos-refine-batch/evals/evals.json);
[`skills-lock.json`](../skills-lock.json); T-018; T-009; F-014.
