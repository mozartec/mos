---
id: T-011
type: task
title: Validator test suite — pin the guarantees review keeps re-proving
status: Todo
priority: P1
phase: Phase 4
owner: mozart
touches: [scripts, ci]
created: 2026-06-12T22:15:00Z
updated: 2026-06-12T22:15:00Z
---

# T-011 — Validator test suite — pin the guarantees review keeps re-proving

[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) is the cheap check every
card edit relies on — and the only load-bearing code in the repo with no tests. Every
guarantee it carries was proven by ad-hoc temp-dir vaults during
[PR #49](https://github.com/mozartec/mos/pull/49)'s review and re-proven by hand each
round; both regressions that review caught were validator regressions. After this task,
those guarantees are committed tests that fail the build on regression instead of
waiting for a review to notice.

## Outcome

- The validator's contract is covered by a test file runnable with the standard
  toolchain and in CI; the throwaway fixtures from PR #49's review become permanent.

## Context — read before starting

- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the script under
  test; its header documents its interim, zero-dependency role.
- [PR #49](https://github.com/mozartec/mos/pull/49) review comments — the regression
  cases the suite must pin, with the exact fixture shapes.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5a (list syntax) and §5c
  (areas/touches semantics) — what the script validates.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Timestamps — the UTC rule the
  script enforces.

## Constraints (must honor)

- **Zero new runtime dependencies** for the script itself; the test file uses only
  node's built-in runner (`node --test`) so the zero-dep stance holds end to end.
- **Fixtures are self-contained**: built programmatically in temp dirs, defining their
  own types/columns — nothing assumes this repo's vocabulary
  ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)),
  and never this repo's live `board/`, which moves.
- `bun run validate` behavior and output stay exactly as today.

## Plan

1. Make the script import-safe: export `validateVault` returning structured
   `{ errors, warnings }` (printing stays in the CLI path), and gate the CLI entry
   behind a main-module check.
2. Add `scripts/validate-vault.test.mjs` on node's built-in runner; fixture vaults are
   created under `os.tmpdir()` per test and removed after.
3. Pin, at minimum (each is a PR #49 finding or near-miss):
   - a vault with neither `areas` nor `touches` → zero errors, zero warnings;
   - a `touches` entry naming no configured area → error, in **all three** shapes:
     areas configured, `areas` key missing with the field registered (empty-set source),
     and missing with the field unregistered (§5c fallback);
   - block-style and quoted inline lists parse identically to inline unquoted; entries
     dedup;
   - block lists under scalar fields (`id`, `parent`, timestamps) → clean diagnostics,
     no crash;
   - two in-flight cards (second-to-last column) with overlapping areas → warning;
     first and last columns exempt; vaults with two columns produce none;
   - unresolved `dependsOn` id → error; duplicate id → error; non-UTC timestamp →
     error; frontmatter order deviation → warning, never an error.
4. Wire the suite into CI next to `bun run validate` (a root script, e.g.
   `test:scripts`), so a validator regression fails the build.

## Acceptance

- [ ] `validateVault` is importable; `bun run validate` output and exit codes are
      byte-identical to before.
- [ ] Every case in plan step 3 has a test, and reverting any one validator guard
      locally makes at least one test fail (spot-checked).
- [ ] CI runs the suite on every PR.

## Dependencies

- **Depends on:** nothing. **Blocks:** nothing — but F-023's validator changes should
  land on top of this suite, not before it.

## Out of scope

Porting the validator into `packages/core` (its header already records that future),
new validation rules, and testing the app.

## References

[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md),
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[PR #49](https://github.com/mozartec/mos/pull/49).
