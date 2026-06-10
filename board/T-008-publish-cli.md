---
id: T-008
type: task
title: CLI packaging hardening and first publish
status: Planned
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [F-015, F-016]
created: 2026-06-10T19:00:00Z
updated: 2026-06-10T19:00:00Z
---

# T-008 — CLI packaging hardening and first publish

The CLI's *engine* is verified (serve/init end-to-end under plain Node, read-only
guarantees tested), but it has never been exercised as an installed npm artifact, and the
registry/name question is undecided. This task closes the gap between "works from the
workspace" and "anyone can install it", and cuts the first published version.

## Outcome

A consumer in another repo (e.g. the ERP project) can install the CLI from a registry and
run `mos init` / `mos serve` with no clone of this repo. The packed artifact is smoke-
tested (locally and in CI), the package name/registry choice is recorded as an ADR, and
the first version is published.

## Context — read before starting

- [`board/F-015-standalone-cli.md`](F-015-standalone-cli.md) and
  [`board/F-016-vault-init.md`](F-016-vault-init.md) — what the CLI is and how it was
  verified so far (workspace-level only).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) ADR-012 — the packaging/runtime
  decision, including the open scoped-name caveat this task resolves.
- [`docs/11-RELEASING.md`](../docs/11-RELEASING.md) §Publishing the CLI — the manual
  publish steps to harden.
- [`apps/cli/package.json`](../apps/cli/package.json) — `bin`, `files`, `publishConfig`.

## Constraints (must honor)

- **Registry reality check before choosing.** GitHub Packages' npm registry requires the
  scope to match the repo owner (so not `@mos/cli` there) and requires an auth token to
  install **even public** packages — which breaks frictionless `npx`. npmjs has neither
  problem, but `@mos` scope availability there is unverified. Verify both facts against
  current docs, decide, and record the decision (and any rename) as a new ADR.
- **The smoke test must use the packed tarball** (`npm pack` → install in a clean temp
  dir → `mos init` → `mos serve` → probe endpoints), not the workspace — that is the
  point of this task.
- **Read-only stays read-only** (ADR-002) — polish must not add write behavior.
- **SemVer per** [`docs/11-RELEASING.md`](../docs/11-RELEASING.md); first publish is
  `0.1.0`, manual is acceptable, automation is out of scope.

## Plan

1. Pack-and-install smoke test: script it (temp dir, install tarball, run `mos init`,
   start `mos serve` on a free port, assert `/`, `/vault/files`, SSE event, non-GET 405),
   then wire it into CI so packaging regressions can't land silently.
2. Decide registry + final package name (see Constraints); record as ADR; apply any
   rename across `apps/cli/package.json`, README, `docs/11-RELEASING.md`,
   `docs/12-ADOPTING.md`.
3. Polish: friendly `EADDRINUSE` message (no stack trace), set the web app's
   `<title>` to the vault name or "mos" (it currently reads `@mos/web`), include the
   web build's `3rdpartylicenses.txt` in the package.
4. Set version `0.1.0` and publish per the releasing doc; verify a cold install from the
   chosen registry in a scratch repo; update docs if any step differed.

## Acceptance

- [ ] A scripted smoke test installs the packed tarball in a clean directory and proves
      `init` + `serve` work (endpoints probed, SSE event observed); it runs in CI.
- [ ] The registry/name decision is recorded as an ADR, and the package, README, and
      docs all use the final name consistently.
- [ ] `EADDRINUSE` produces a one-line human error; the served page title no longer
      reads `@mos/web`; third-party license file ships in the package.
- [ ] Version `0.1.0` is published and a cold `install`/`npx` from the chosen registry
      renders a vault in a repo that is not mos.
- [ ] `docs/11-RELEASING.md` and `docs/12-ADOPTING.md` match what was actually done.

## Dependencies

- **Depends on:** F-015, F-016 (the CLI being published). **Blocks:** —

## Out of scope

Release automation (release-please et al. — tracked by the releasing doc), Windows CI
(note results if tried, don't gate on it), publishing the skills (they install from the
repo path and shipped with F-014), the desktop app (F-007).

## References

ADR-002, ADR-012; `docs/11-RELEASING.md`, `docs/12-ADOPTING.md`.
