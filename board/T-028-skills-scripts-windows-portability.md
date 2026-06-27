---
id: T-028
type: task
title: mos CLI/scripts crash on Windows (cp1252 console encoding + python3 invocation)
status: Todo
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [F-014]
touches: [skills]
created: 2026-06-27T15:15:31Z
updated: 2026-06-27T15:15:31Z
---

# T-028 — mos skill scripts crash on Windows (cp1252 console + python3 invocation)

The bundled skill scripts (`ship_card.py`, `next_card.py`, `refine_batch.py`) were written
and tested on macOS. First run on Windows 11 (PowerShell 7 + Git Bash, Python via the `py`
launcher) surfaced two portability bugs that make the skills unusable on a stock Windows
console. This card makes the three scripts and their SKILL docs run clean on Windows without
touching any vault-parsing behavior. (Scope is the **bundled skill scripts** under `skills/`,
not the separate Node `@mozartec/mos-cli`, which isn't implicated.)

## The two bugs

**Bug 1 — `UnicodeEncodeError` on non-ASCII stdout (primary, high severity).**
All three scripts print non-ASCII glyphs straight to stdout. **Seven have no cp1252
representation** and so crash a Windows console (default "charmap" codec) the moment
`print()` reaches one: `✓` U+2713, `✗` U+2717, `→` U+2192, `←` U+2190, `ℹ` U+2139,
`⚠` U+26A0, `∅` U+2205. (Two more are printed but **are** representable in cp1252 —
`·` U+00B7 and `—` U+2014 render fine, don't crash; they matter only for the
"byte-identical on UTF-8" guarantee below, not for the crash.) `print()` raises:

```
UnicodeEncodeError: 'charmap' codec can't encode character '✓' in position 0:
character maps to <undefined>
```

Every line printing one of those seven glyphs is exposed — the `ship_card.py` `finish()`
success line ([`ship_card.py:214`](../skills/mos-ship-card/scripts/ship_card.py)), the
human-readable blocks in `ship_card.py` `main()` (deps `✓/✗`, the `ℹ` container note, the
`⚠` checklist, `→`), the `→`/`⚠`/`∅` lines in `next_card.py`'s `print_batch`/`main`, and
in `refine_batch.py` the `∅`/`⚠` lines plus `→` (line 271) and **`←` in the `← possible
HUB` line ([`refine_batch.py:290`](../skills/mos-refine-batch/scripts/refine_batch.py))** —
so an ASCII-fallback fix (option b below) must enumerate `←`/`→`, not just the obvious
glyphs, or `refine_batch.py` still crashes when a cluster has ≥3 cards. The macOS/Linux
locale is UTF-8 so the bug never showed there. The observed workaround was `PYTHONUTF8=1` /
`PYTHONIOENCODING=utf-8`; the fix should make the scripts self-sufficient so no env var is
required.

**Bug 1a — `--finish` reports failure after a successful write (the nasty part).**
`finish()` already does the right thing *structurally*: it reads the card, sets `status`,
bumps `updated`, ticks the Acceptance boxes, **writes the file**
([`ship_card.py:213`](../skills/mos-ship-card/scripts/ship_card.py)), and only **then**
prints the `✓` confirmation ([`ship_card.py:214`](../skills/mos-ship-card/scripts/ship_card.py)).
So it is **already write-then-print, and already idempotent on re-run** (re-setting the
`status:` line and re-ticking already-`[x]` boxes converges) — that idempotency is exactly
what saved the reporter. The residual defect is narrow but confusing: when the post-write
`print()` throws `UnicodeEncodeError`, the exception is uncaught, the process exits
**non-zero**, and the agent sees a *failed* command — yet the card **was** set to Done with
its boxes ticked. A partial-success that reads as a failure. The fix must guarantee the
confirmation print **cannot turn a completed mutation into a non-zero exit** — and the
encoding reconfigure (step 1) alone doesn't fully deliver that: it stops the *encode*
crash, but a broken pipe or other `OSError` on stdout could still propagate. So the
guarantee comes from **wrapping the post-write confirmation in a best-effort `try/except`**
(catching at least `UnicodeEncodeError` and `OSError`/`BrokenPipeError`) — once the card is
written, the process exits 0 regardless of the cosmetic print.

**Bug 2 — `python3` not resolvable on Windows (medium).**
The SKILL docs and the script docstrings invoke `python3 <skill-dir>/scripts/x.py`. On a
stock Windows install `python` / `python3` are usually Microsoft Store **alias stubs** (they
open the Store, or are absent); the interpreter that actually works is the **`py` launcher**
(`py -3`). The instruction an agent copies must resolve on Windows.

## Outcome

`ship_card.py`, `next_card.py`, and `refine_batch.py` run to completion on a stock Windows
cp1252 console with no `UnicodeEncodeError` and no required env vars; `ship_card.py --finish`
never leaves a card mutated while exiting non-zero; and every SKILL doc / docstring / README
line that tells an agent how to run a script names an interpreter that resolves on Windows.
Output stays byte-identical on a UTF-8 console (macOS/Linux), so nothing regresses there.

## Context — read before starting

- [`skills/mos-ship-card/scripts/ship_card.py`](../skills/mos-ship-card/scripts/ship_card.py)
  — the worst case: `finish()` (write-then-print, lines 199–215) plus the glyph-heavy
  human output in `main()`. Both the encoding fix and the exit-code hardening land here.
- [`skills/mos-next-card/scripts/next_card.py`](../skills/mos-next-card/scripts/next_card.py)
  and [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
  — same encoding fix; no write path, so no exit-code concern.
- [`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md) (lines 31–33, 105),
  [`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md) (lines 30–31),
  [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md) (line 48) — the
  `python3 <skill-dir>/scripts/…` invocations to make Windows-resolvable. Also the three
  script docstrings' `Run with Python 3:` examples and [`skills/README.md`](../skills/README.md)
  line 15 ("Python 3 for the bundled scripts").
- [`skills/README.md`](../skills/README.md) §Conventions — bundled scripts are
  **zero-dependency, stdlib-only Python 3** and config-driven; SKILL.md stays short and
  rule-dense (these run on small models). The fix must honor all three.
- [`skills/evals/README.md`](../skills/evals/README.md) — how skills are exercised cold
  against the fixture vaults; the regression check below piggybacks on those fixtures.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Comments — present-mechanics-only;
  if a glyph fallback is gated, no "for now"/future-tense comment.

## Constraints (must honor)

- **Zero-dependency, stdlib-only Python 3.** No new imports beyond the standard library
  (`skills/README.md`). The encoding fix uses only `sys`/`io`.
- **Scripts are bundled per skill — no shared module.** Each skill folder is installed
  independently, so the three scripts can't import a common helper; the startup fix is
  **duplicated** into each script (keep it identical so the installed copies stay in sync).
- **No vault-parsing change; config-driven behavior is untouched (F-014, ADR-003).** This
  card changes only the scripts' own stdout I/O and the docs' invocation string — not how
  any card, type, state, or area is read. `--json` output and all human text stay
  byte-identical on a UTF-8 console.
- **`--finish` is the one allowed vault write (ADR-002).** It must stay frontmatter-only +
  Acceptance-tick, and must end in a consistent state: card written ⇒ exit 0.
- **SKILL.md stays short and rule-dense.** The interpreter guidance is one terse rule, not a
  paragraph — it runs on small models.

## Plan

1. **Force-safe stdout at startup, in all three scripts (duplicated helper).** At the top of
   `main()` (or a tiny `_safe_stdout()` called first), reconfigure stdout/stderr so non-ASCII
   can't crash on cp1252 — e.g.
   `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` guarded by
   `hasattr(sys.stdout, "reconfigure")` (TextIOWrapper since 3.7; guard covers redirected
   streams). Reconfigure `stderr` too as defensive insurance — no current stderr message
   carries a crashing glyph, but a future one shouldn't reintroduce the bug. Decide one of:
   (a) keep the glyphs and rely on UTF-8 reconfigure (simplest; on a non-UTF-8 console the
   bytes may render as mojibake but **never crash**), or (b) additionally swap glyphs for
   ASCII (`[OK]`/`->`/`!`) when `sys.stdout.encoding` can't represent them. Either satisfies
   "no crash"; pick (a) unless clean Windows output is wanted — record the choice in the PR.
2. **Harden `ship_card.py` `finish()` (Bug 1a).** Step 1 stops the *encode* crash, but the
   exit-0-after-write guarantee must be explicit: wrap the post-write confirmation in a
   best-effort `try/except` (catch `UnicodeEncodeError`, `OSError`/`BrokenPipeError`) so
   **no** stdout failure can produce a non-zero exit on an already-written card. Keep the
   existing write-then-print order and idempotency; add a regression note in the PR that
   re-running `--finish` still converges.
3. **Fix the interpreter invocation (Bug 2).** In the three SKILL.md files, the three script
   docstrings, and `skills/README.md`, replace bare `python3 …` with guidance that resolves
   on Windows — prefer the `py` launcher there. One rule-dense line, e.g.: *"Run with
   Python 3: `py -3 <skill-dir>/scripts/x.py …` on Windows, `python3 …` (or `python …`)
   elsewhere."* Keep it short; don't bloat SKILL.md.
4. **Regression check (CI-runnable on Linux, proxies the Windows console).** Forcing
   `PYTHONIOENCODING=cp1252` reproduces the exact `'charmap' codec can't encode` failure on
   Linux. Run each script under that env against a fixture vault and assert exit 0 + no
   `UnicodeEncodeError`, covering the glyph-bearing paths concretely: `next_card.py` default
   + `--parallel` (+ `--parallel` on a no-`areas` vault); `ship_card.py` pre-flight on a leaf
   and on a container card, plus `--finish` on a throwaway copy (asserting exit 0 **and** the
