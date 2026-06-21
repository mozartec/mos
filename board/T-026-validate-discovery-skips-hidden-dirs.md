---
id: T-026
type: task
title: mos validate discovery skips hidden dirs — no phantom .claude/worktrees vaults
status: Done
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [F-029]
touches: [cli]
created: 2026-06-21T00:03:04Z
updated: 2026-06-21T00:03:04Z
---

# T-026 — mos validate discovery skips hidden dirs — no phantom .claude/worktrees vaults

`mos validate <dir>` discovers every vault at or under `dir` by walking the tree for
`.mos/config.json` ([`discoverVaults`](../apps/cli/src/validate.ts)). Its ignore list was a
**named** set — `node_modules, .git, .angular, .turbo, dist, .cache` — so any *other* hidden
directory was descended into. In a repo with git worktrees under `.claude/worktrees/*` (which
Claude Code creates, and which carry their own full vault copy), each worktree's stale
`.mos/config.json` was reported as a separate "phantom" vault: running `mos validate .` at the
root printed the real vault plus N stale duplicates. The running app does **not** have this
problem — the server's file walk ([`packages/vault-server/src/files.ts`](../packages/vault-server/src/files.ts))
already skips *all* hidden directories except `.mos`. So `validate` and the app disagreed on
what's in the vault; `validate` was the outlier. (Found while migrating a real adopter's vault
to spec 0.4 — its 5 local worktrees showed up as 5 extra vaults.)

## Outcome

- `discoverVaults` and the per-vault file `walk` skip **any hidden directory** (name starts
  with `.`) except `.mos`, in addition to `node_modules`/`dist` — matching the server's walk, so
  `mos validate` and the app agree on the vault's contents.
- A repo with worktrees (or any tool dir: `.claude`, `.vscode`, `.dev`, …) validates as the one
  real vault; no phantom duplicates, and no spurious CI failure from a half-finished card sitting
  in a worktree copy.
- The former named entries are subsumed: `.git`/`.angular`/`.turbo`/`.cache` are all hidden, so
  the rule is `node_modules`/`dist` + hidden-except-`.mos` — fewer special cases, same coverage.

## Context — read before starting

- [`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts) — the `IGNORE` set, `discoverVaults`
  (vault discovery), and `walk` (per-vault card collection); both consumed the named set.
- [`packages/vault-server/src/files.ts`](../packages/vault-server/src/files.ts) — the server's
  walk: skips a segment when it `startsWith('.') && !== '.mos'` or is `node_modules`. The
  behavior to align to.
- [`apps/cli/src/validate.test.ts`](../apps/cli/src/validate.test.ts) — `discoverVaults` tests
  (nested vault, symlink-cycle); the place for the hidden-dir case.
- F-029 — added `mos validate`, which owns this discovery.

## Constraints (must honor)

- **Keep `.mos` discoverable/walkable** — it holds the config; only *other* hidden dirs are
  skipped. Discovery additionally never descends into `.mos` (no nested vault lives there), as
  before.
- **Behavior parity with the server walk** — same skip rule, so the two stay consistent.
- **Pure-core boundary intact (ADR-001)** — this is the CLI's I/O shell; no rule moves into core.
- **Don't follow symlinks** — the existing symlink-cycle guard stays.

## Plan

1. Replace the named `IGNORE` with `node_modules`/`dist` + an `ignoredDir(name)` helper that also
   skips any `.`-prefixed dir except `.mos`.
2. Use `ignoredDir` in both `discoverVaults` (keeping its extra `.mos` skip) and `walk`.
3. Add a `discoverVaults` test: a vault planted under `.claude/worktrees/wt/` is not discovered;
   only the root vault is.
4. Scoped tests, then the full gate.

## Acceptance

- [x] `discoverVaults` and `walk` skip any hidden directory except `.mos` (plus
      `node_modules`/`dist`); `.mos` is still discovered/walked.
- [x] A vault planted under `.claude/worktrees/*` is **not** discovered — `discoverVaults(root)`
      returns only the root (new test).
- [x] Discovery still skips `.git`/build dirs (now via the hidden rule) and does not follow
      symlinks (existing tests green).
- [x] `bunx turbo run test --filter=@mozartec/mos-cli` passes; full `lint && test && build &&
      validate` is green.

## Dependencies

- **Depends on:** F-029 (the `mos validate` discovery this corrects). **Blocks:** nothing.

## Out of scope

A config-driven discovery ignore list (the hidden-dir + `node_modules`/`dist` default is right
for every adopter; no per-vault knob needed); changing the server walk (already correct);
deduping the two walks into one shared helper in core (possible later cleanup, not this fix); and
the smoke/README/guide work (T-023).

## References

[`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts);
[`packages/vault-server/src/files.ts`](../packages/vault-server/src/files.ts);
[`apps/cli/src/validate.test.ts`](../apps/cli/src/validate.test.ts); F-029.
