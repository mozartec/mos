---
id: T-015
type: task
title: Prettier CI gate — format the repo and check formatting on every PR
status: Done
priority: P2
phase: Phase 4
owner: mozart
touches: [cli, core, server, scripts, skills, ci]
created: 2026-06-14T00:38:48Z
updated: 2026-06-14T13:08:23Z
---

# T-015 — Prettier CI gate — format the repo and check formatting on every PR

The repo declares a Prettier config and a `format` script, but nothing runs it: 35
source files have drifted out of Prettier style and the drift is invisible until
someone reformats a file they're editing and the diff balloons with unrelated lines.
This formats the repo once and adds a CI step so drift can't return.

## Outcome

- `bun run format` (`prettier --check .`) passes on a clean checkout, and CI fails any
  PR that introduces unformatted code.
- A husky pre-commit hook runs lint-staged (`prettier --write`) so drift is fixed
  locally before it ever reaches CI — fast feedback; CI stays the source of truth.

## Context — read before starting

- [`.prettierrc`](../.prettierrc) and [`.prettierignore`](../.prettierignore) — the
  config (prose, `board/`, `docs/`, build dirs, and lockfiles are already excluded, so
  only source code is in scope).
- [`package.json`](../package.json) — `format` / `format:fix` scripts already exist.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — where the gate is wired.

## Constraints (must honor)

- **Formatting only — no behavior changes.** The reformat is `prettier --write .`; no
  logic is edited by hand.
- **The check must pass before it's enforced** — run `prettier --write .`, then confirm
  `bun run format` is green, so the new CI step is green from its first run.
- Place the step before any build step so build outputs (already in `.prettierignore`)
  can never affect it.

## Plan

1. `bun run format:fix` (`prettier --write .`) to bring the 35 drifted files into style.
2. Add a `Format` step to [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
   running `bun run format`, alongside the other static checks.
3. Verify the reformat changed nothing functional: `bun run lint`, the package test
   suites, `bun run test:scripts`, and `bun run validate` (byte-identical output) all
   stay green.
4. Add husky + lint-staged (root dev tooling, no turbo task): a `prepare: husky`
   script so it self-installs on `bun install`, and a `.husky/pre-commit` running
   `bunx lint-staged`, configured to `prettier --write --ignore-unknown` (same
   `.prettierignore` as the gate).

## Acceptance

- [x] `bun run format` passes on the branch (zero files flagged).
- [x] CI runs `bun run format` on every PR, before the build step.
- [x] No behavioral regressions: lint, tests, `test:scripts`, and `validate` are green
      and `bun run validate` output is unchanged.
- [x] A husky pre-commit hook runs lint-staged (`prettier --write`) on staged files;
      committing a misformatted file auto-formats it.

## Dependencies

- **Depends on:** nothing. **Blocks:** nothing. (Originally drafted to stack on
  [T-011](T-011-validator-test-suite.md) since both touch `scripts/validate-vault.mjs`
  and `ci.yml`; T-011 has since merged, so this targets `main` directly and reformats
  T-011's files along with the rest.)

## Out of scope

New lint/style rules, running ESLint in the hook (per-package flat configs don't
resolve cleanly from a root hook — prettier-only keeps it reliable), and reformatting
prose (`docs/`, `board/`, `*.md` are deliberately ignored).

## References

[`.prettierrc`](../.prettierrc), [`.prettierignore`](../.prettierignore),
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
