---
id: T-029
type: task
title: Scripts test suite fails on Windows — path-separator and CRLF assumptions in the tests
status: Todo
priority: P2
phase: Phase 4
owner: mozart
touches: [scripts]
created: 2026-07-02T11:45:29Z
updated: 2026-07-02T11:45:29Z
---

# T-029 — Scripts test suite fails on Windows — path-separator and CRLF assumptions in the tests

`bun run test:scripts` has 8 failures on a stock Windows checkout — on clean `main`, before
any change (surfaced while shipping PR #88; Linux CI is green). All 8 are bugs in the **test
files**, not in the code under test: the production scripts already handle both separators
and `\r?\n`. Until fixed, the whole suite exits 1 on Windows, masking real regressions for
anyone developing there. (T-028 fixed the *skill scripts'* Windows portability — cp1252
console, `py -3` invocation; this card is the same theme one layer up, in the repo's own
test files.)

## The two bugs

**Bug 1 — path-separator assumption (2 failures).**
[`scripts/check-forward-comments.test.mjs`](../scripts/check-forward-comments.test.mjs)
(~lines 102–116): the two `collectFiles` tests reduce collected paths with
`p.split('/').pop()`. On Windows `collectFiles` returns `\`-separated absolute paths, so the
split never splits and the assertion compares a full path against a bare filename:

```
+   'C:\\Users\\…\\mos-fwd-2l8gOp\\a.ts'
-   'a.ts'
```

**Bug 2 — LF-only frontmatter regex in a test helper (6 failures).**
[`scripts/refine-batch-readiness.test.mjs`](../scripts/refine-batch-readiness.test.mjs)
(~line 77): `setBody()` swaps a fixture card's body with
`text.replace(/^(---\n[\s\S]*?\n---\n)[\s\S]*$/, …)`. With `core.autocrlf=true` the working
tree is CRLF, the `---\n` anchors never match, the replace **silently no-ops**, and the
fixture card keeps its stub body — so every test that mutates the body reports all readiness
sections missing. The script under test
([`refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
`parse_frontmatter`) already matches `\r?\n`; only the test helper is LF-bound.

## Outcome

- `bun run test:scripts` exits 0 on a Windows checkout (`core.autocrlf=true`), all tests
  passing — no skips added to get there.
- Behavior on LF checkouts (Linux/macOS, CI) is unchanged; the suite stays green there.
- Only the two test files change; the production scripts and skills are untouched.

## Context — read before starting

- [`scripts/check-forward-comments.test.mjs`](../scripts/check-forward-comments.test.mjs) —
  the two `collectFiles` tests; split on both separators (e.g. `p.split(/[\\/]/).pop()`) or
  use `node:path` `basename`.
- [`scripts/refine-batch-readiness.test.mjs`](../scripts/refine-batch-readiness.test.mjs) —
  `setBody()`; make the frontmatter regex CRLF-tolerant (`---\r?\n`), mirroring
  `refine_batch.py`'s `parse_frontmatter`. Check the file's other regex-based mutators
  (`stripReadiness`, `setReadiness`, the `.replace(/^touches:.*$/m, …)` callers) for the
  same assumption while there.
- T-028 — the precedent card for Windows portability (scope there: the bundled skill
  scripts; scope here: the repo's own script tests).
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Comments — present-mechanics-only.

## Constraints (must honor)

- **Fix the tests, not the tested code.** No change to `check-forward-comments.mjs`,
  `refine_batch.py`, or any skill; if a real product bug turns up while fixing, record it as
  a finding for its own card instead of widening scope.
- **No skipped tests.** The suite must pass by being correct on both EOL/separator
  conventions, not by `skip`-ing on `win32` (the CLI symlink test's junction fallback in
  PR #88 is the model: keep the guarantee, adapt the mechanism).
- **Scope is `scripts/` test files only** (`touches: [scripts]`).

## Plan

1. Fix the two `collectFiles` assertions to be separator-agnostic.
2. Make `setBody()`'s frontmatter regex CRLF-tolerant; sweep the file's other mutators for
   LF-only anchors.
3. Run `bun run test:scripts` on Windows (expect 0 fail) and on an LF checkout or via CI
   (unchanged).
4. Full gate once at the end.

## Acceptance

- [ ] `bun run test:scripts` passes on a Windows checkout with `core.autocrlf=true` — the 8
      pre-existing failures are gone, with no test skipped or weakened.
- [ ] The suite still passes on an LF checkout (Linux CI green, no assertion loosened).
- [ ] Only `scripts/check-forward-comments.test.mjs` and
      `scripts/refine-batch-readiness.test.mjs` changed; production scripts untouched.
- [ ] Full gate (`bun run lint && test && build && validate`) green.

## Dependencies

- **Depends on:** nothing. **Related:** T-028 (Windows portability of the skill scripts —
  Done); PR #88 (where the failures were surfaced and recorded). **Blocks:** nothing.

## Out of scope

Adding a Windows runner to CI (worth its own card if wanted); any change to the production
scripts or skills; the pick/ship/refine skill behavior.

## References

[`scripts/check-forward-comments.test.mjs`](../scripts/check-forward-comments.test.mjs);
[`scripts/refine-batch-readiness.test.mjs`](../scripts/refine-batch-readiness.test.mjs);
[`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py);
T-028; [PR #88](https://github.com/mozartec/mos/pull/88).
