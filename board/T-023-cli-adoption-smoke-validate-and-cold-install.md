---
id: T-023
type: task
title: CLI release readiness — smoke covers `mos validate` + cold install; npm README + emitted guide current
status: Done
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-029, F-030]
touches: [cli, config]
created: 2026-06-20T21:15:27Z
updated: 2026-06-20T22:06:21Z
---

# T-023 — CLI release readiness — smoke covers `mos validate` + cold install; npm README + emitted guide current

`@mozartec/mos-cli` is the front door for adopting mos in another repo, and this is the
pre-release gate before cutting **0.3.0** (the version that publishes `mos validate` (F-029) and
the scaffolded framework guide (F-030) on top of `0.2.1`). Three things must be true of what
ships to npm. **(1)** The end-to-end smoke test
([`apps/cli/scripts/smoke.mjs`](../apps/cli/scripts/smoke.mjs)) already packs the tarball,
installs it in a clean temp project, runs `mos init`, serves the result, and asserts read-only —
but it never runs **`mos validate`** on the freshly-scaffolded vault, so the third command is
untested in the adoption path. **(2)** The **npm landing page** is
[`apps/cli/README.md`](../apps/cli/README.md) — npm renders the *package's* readme, not the repo
root — so it must stand on its own and be the canonical command reference. **(3)** The
**framework guide** the CLI emits to `.mos/AGENTS.md` is generated from the `frameworkGuide()`
template in [`apps/cli/src/init.ts`](../apps/cli/src/init.ts) (F-030); the committed
`.mos/AGENTS.md` is its scaffolded output, so the two can silently drift. This task closes all
three: the smoke run exercises all three commands against a cold install, the npm README is
current and self-contained for 0.3.0, and the emitted guide is confirmed current (committed copy
regenerated if it drifted).

**On the two READMEs (decided):** the repo keeps *two* purpose-built readmes — root
[`README.md`](../README.md) is the GitHub project landing (whole product: format + app + skills),
`apps/cli/README.md` is the npm package page. We do **not** try to make one serve both (the
nested-package link-rewriting isn't worth it). The only deliberately-accepted overlap is the
one-line pitch + the install/quickstart (each surface must stand alone); the command reference is
single-sourced *here* in the CLI readme, and cross-links from it use **absolute** GitHub URLs
(already the case) so they work on the npm page. Trimming the root README's duplication is
T-025's job (`docs`); this card owns the CLI readme (`cli`).

## Outcome

- `smoke.mjs` runs `mos validate` on the just-`init`ed vault and asserts a clean result
  (exit 0, the scaffolded card maps to a column) — so init → serve → validate are all proven
  against the packed, installed artifact, not just init + serve.
- The smoke run reaches the CLI through its installed `mos` bin (the published entry point an
  adopter actually invokes), not only a direct `node dist/...` path.
- `apps/cli/README.md` is confirmed current and self-contained for the npm page: the one-line
  pitch, install (npx + global), the command table (incl. `validate` and `--version`/`--help`),
  what a vault is, and the read-only note all read true for 0.3.0; every cross-link is an
  absolute GitHub URL so it resolves on npm. It is the **canonical command reference** other docs
  point to.
- The `frameworkGuide()` output in `init.ts` is verified current against spec 0.4 and the
  shipped command surface (it names `mos serve` / `mos validate`, the three columns, the write
  rules); the committed `.mos/AGENTS.md` is byte-regenerated from it if it has drifted.
- `bun run --filter @mozartec/mos-cli smoke` passes; the full gate is green.

## Context — read before starting

- [`apps/cli/scripts/smoke.mjs`](../apps/cli/scripts/smoke.mjs) — the existing adoption
  rehearsal: `npm pack` → install in a temp dir → `init` → `serve --port 0` → probe `/`,
  `/vault/files`, the SSE watch, and the read-only `POST` rejection. Add the `validate` leg
  here; mirror the existing `ok()`/`fail()` assertion style.
- [`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts) — what `mos validate` does and its
  exit-code contract (0 clean / 1 errors / 2 no vault). The smoke vault is the `init` scaffold,
  which must validate clean (exit 0).
- [`apps/cli/README.md`](../apps/cli/README.md) — the npm landing page; already in good shape
  (documents all three commands + `--version`/`--help`, uses absolute GitHub links). Verify, keep
  current for 0.3.0; this is the canonical command reference.
- [`apps/cli/package.json`](../apps/cli/package.json) — `version` (`0.2.1` → bump for the
  release), `description`, `repository.directory` (`apps/cli`, which is how GitHub/npm resolve the
  readme's relative paths if any). Note: product copy only, no ADR/card ids in published metadata.
- [`apps/cli/src/init.ts`](../apps/cli/src/init.ts) — `frameworkGuide(specVersion)` (the guide
  template, ~line 150) and the `write('.mos/AGENTS.md', frameworkGuide(SPEC_VERSION))` call
  (~line 303). This is the **canonical** guide source; `.mos/AGENTS.md` is generated from it.
- [`.mos/AGENTS.md`](../.mos/AGENTS.md) — this repo's scaffolded copy; the regen target if the
  template changed. Lives under `.mos/` (area `config`).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — spec 0.4, the contract the guide claims
  to target (`Targets vault spec version 0.4`); confirm that claim still holds.
- F-029 — added `mos validate` (the command this proves in the adoption path).
- F-030 — scaffolded the framework guide into `init`; this verifies its emitted output.

## Constraints (must honor)

- **The CLI stays read-only over existing vaults (ADR-002).** This touches only the
  scaffolder's emitted text and the test harness; no new write/edit path over a real vault.
- **`init` stays a one-time bootstrap (ADR-013)** — refuses an existing vault, never
  overwrites. Don't weaken that to make the smoke flow easier.
- **Smoke runs against the packed artifact**, not the workspace source — keep the
  `npm pack` → install → run shape so it exercises what adopters get.
- **The committed `.mos/AGENTS.md` must be byte-identical to `frameworkGuide(SPEC_VERSION)`**
  after this lands (it's a generated artifact); regenerate, don't hand-edit.
- **Guide edits, if any, are confined to `init.ts` + the regenerated `.mos/AGENTS.md`** — the
  human adoption walkthrough (`docs/12-ADOPTING.md`) is T-025's area; the skills are T-024's.
- **The npm README is self-contained.** `apps/cli/README.md` must read standalone on the npm page;
  cross-links are absolute GitHub URLs (never `../docs/...` relative paths, which break on npm).
  The accepted overlap with root `README.md` is *only* the pitch + install/quickstart; the command
  reference is single-sourced here. Don't fold the root README into it or vice-versa.
- **Don't edit root `README.md` or `docs/`** here — that consolidation is T-025 (`docs`); this card
  is `cli`/`config` so the batch stays parallel-safe. Flag cross-card drift as a finding.
- **Bump `updated`** on this card when ticking its Acceptance boxes; no other prose edits.

## Plan

1. Read `smoke.mjs`; add a `validate` step after the serve probes (or alongside init):
   `node <mosBin> validate <consumerDir>`, assert exit 0 and that the report names the
   scaffolded card / its column.
2. Confirm the smoke path invokes the installed `mos` bin; if it only uses a direct dist path,
   add (or switch to) the installed-bin invocation so the published entry point is covered.
3. Review `apps/cli/README.md` as an npm visitor: confirm the pitch, install, command table
   (incl. `validate` + `--version`/`--help`), vault explainer, and read-only note are accurate
   for 0.3.0 and that every link is an absolute GitHub URL; fix anything stale.
4. Diff `frameworkGuide(SPEC_VERSION)` output against the committed `.mos/AGENTS.md`; if they
   differ, regenerate the committed copy. Verify the guide's spec-version claim and command
   names still match reality; fix the template if stale.
5. Run `bun run --filter @mozartec/mos-cli smoke` and the CLI test suite.
6. Full gate once: `bun run lint && bun run test && bun run build && bun run validate`.

## Acceptance

- [x] `smoke.mjs` runs `mos validate` on the `init`-scaffolded vault and asserts a clean
      result; init → serve → validate are all exercised against the packed, installed CLI.
- [x] The smoke flow invokes the published `mos` bin (the adopter's entry point), not only a
      direct dist path.
- [x] `apps/cli/README.md` reads standalone for the npm page — pitch, install, the command table
      (incl. `validate` + `--version`/`--help`), vault explainer, read-only — all accurate for
      0.3.0, with only absolute GitHub cross-links; it is the canonical command reference.
- [x] `frameworkGuide(SPEC_VERSION)` output equals the committed `.mos/AGENTS.md` byte-for-byte,
      and the guide's spec-version + command references match the shipped surface.
- [x] `bun run --filter @mozartec/mos-cli smoke` passes; full `lint && test && build && validate`
      is green.

## Dependencies

- **Depends on:** F-029 (the `validate` command the smoke leg exercises), F-030 (the guide the
  scaffolder emits). **Blocks:** nothing.

## Out of scope

New CLI commands or flags; changing validation rules or the report format (T-022 owns the
renderer dedup); rewriting the framework guide's content beyond fixing drift; trimming/consolidating
the **root** `README.md` and the `docs/` adoption walkthrough (T-025 — `docs`); the skills and their
evals (T-024); and the version bump / publish itself (the release is run after this card gates it).

## References

[`apps/cli/scripts/smoke.mjs`](../apps/cli/scripts/smoke.mjs);
[`apps/cli/src/validate.ts`](../apps/cli/src/validate.ts);
[`apps/cli/src/init.ts`](../apps/cli/src/init.ts); [`apps/cli/README.md`](../apps/cli/README.md);
[`apps/cli/package.json`](../apps/cli/package.json); [`.mos/AGENTS.md`](../.mos/AGENTS.md);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md); F-029; F-030.
