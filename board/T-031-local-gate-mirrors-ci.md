---
id: T-031
type: task
title: Local "gated suite" doesn't mirror CI — agents ship PRs that fail checks
status: Todo
priority: P2
phase: Phase 4
owner: mozart
touches: [docs, ci]
created: 2026-07-04T10:36:59Z
updated: 2026-07-04T10:36:59Z
---

# T-031 — Local "gated suite" doesn't mirror CI — agents ship PRs that fail checks

The doc that agents follow before opening a PR names a **subset** of the CI gate, so a
change can pass every local check and still fail CI. [`AGENTS.md`](../AGENTS.md) tells you
to run `bun run lint && bun run test && bun run build && bun run validate` once at the end,
but [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs **eight** steps: `lint`,
`format`, `test`, `build`, `smoke` (packed CLI), `test:scripts`, `check:comments` (the
ADR-023 guard), and `validate`. Four are absent from the documented command —
**`format`, `smoke`, `test:scripts`, `check:comments`** — so an agent following the docs
gets a green local run and a red PR. This actually happened: F-036-S-01 passed the local
four but failed CI on `check:comments` (an un-carded "future" in a comment), costing a
round-trip. There is **no single command** that reproduces the CI gate locally, and the two
lists can drift apart silently because neither derives from the other.

## Outcome

- One script — e.g. `bun run verify` (name TBD) in [`package.json`](../package.json) — runs
  the **exact** CI check sequence locally, in the same order, so a green `verify` predicts a
  green CI job.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) is refactored to invoke that one
  script (or the script and the workflow are asserted equal by a test), so the local gate and
  CI cannot drift — a step added to CI is a step `verify` gains for free.
- [`AGENTS.md`](../AGENTS.md) (the "Before you call it done" checklist) and any skill that
  says "run the project's full checks" point at `bun run verify`, not the partial four-command
  list. The `.agents/skills/mos-ship-card` copy is regenerated from `skills/` if its wording
  changes (never hand-edited — see [T-009](T-009-refresh-installed-skills.md)).

## Context — read before starting

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — the source of truth for the gate;
  its step list is what `verify` must mirror (note `smoke` targets `@mozartec/mos-cli` only).
- [`package.json`](../package.json) — the existing `lint`/`format`/`test`/`build`/`smoke?`/
  `test:scripts`/`check:comments`/`validate` scripts to compose.
- [`AGENTS.md`](../AGENTS.md) §"Before you call it done" — the documented (partial) command.
- [`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md) — step 6 "run the
  project's full checks once"; it defers to AGENTS/README for the command, so fixing the doc
  may be enough, but verify the skill wording doesn't itself hardcode the partial list.
- [ADR-023](../docs/08-DECISIONS.md) — the forward-comment guard whose omission caused the miss.

## Constraints (must honor)

- **Single source of truth.** The point is that local and CI can't diverge; don't hand-copy the
  step list into two places that can drift — derive one from the other, or add a test that fails
  when they differ.
- **Don't weaken the gate.** `verify` is additive convenience; it must run *at least* what CI
  runs. Keep `smoke`'s package filter intact.
- **Windows-runnable.** Contributors run this on Windows (see [T-028](T-028-skills-scripts-windows-portability.md)/
  [T-029](T-029-scripts-tests-windows-portability.md)); a chained `&&` bun script is portable,
  but confirm `smoke`/`test:scripts` behave (or document any that are CI-only).
- **Read-only app (ADR-002); config-driven (ADR-003)** — unaffected; this is repo tooling/docs.

## Plan

1. Add a `verify` script to `package.json` chaining the CI steps in CI order.
2. Make `ci.yml` call `bun run verify` (one "Verify" step) — or keep granular CI steps but add a
   test asserting the `verify` chain equals the workflow's step list, so drift is caught.
3. Update `AGENTS.md`'s "Before you call it done" to run `bun run verify`; scan skills for the
   partial-list wording and fix + reinstall if present.
4. Run `bun run verify` on a clean checkout to confirm it's green and reproduces CI.

## Acceptance

- [ ] A single command (`bun run verify` or equivalent) runs every CI check locally, in CI order.
- [ ] Local gate and CI cannot silently drift: CI invokes the shared script, or a test fails when
      the two step lists differ.
- [ ] `AGENTS.md` (and any skill that names the checks) points at the single command, not the
      partial four-command list.
- [ ] `bun run verify` is green on `main` and Windows-runnable (or CI-only steps are documented).

## Dependencies

- **Depends on:** — . **Related:** [T-015](T-015-prettier-ci-gate.md) (added the `format` gate),
  [T-019](T-019-intent-not-in-comments.md) (added the `check:comments` guard) — the two steps most
  likely to surprise a contributor, and the reason this reconciliation is worth doing.

## Out of scope

Adding or removing any CI check (this only makes the existing gate reproducible locally);
changing what `check:comments`/`test:scripts` enforce; pre-commit hook changes beyond what's
needed to point docs at the new command.

## References

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`package.json`](../package.json),
[`AGENTS.md`](../AGENTS.md); [ADR-023](../docs/08-DECISIONS.md);
[T-015](T-015-prettier-ci-gate.md), [T-019](T-019-intent-not-in-comments.md).
