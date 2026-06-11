---
id: T-010
type: task
title: Release automation — versioning, changelog, npm publish from CI
status: In Progress
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [T-008]
created: 2026-06-10T21:37:00Z
updated: 2026-06-11T11:23:00Z
---

# T-010 — Release automation — versioning, changelog, npm publish from CI

Releasing is manual today: a human bumps the version, maintains `CHANGELOG.md`, runs the
build + smoke test, and `npm publish`es from their machine (T-008 hardened exactly that
path for `0.1.0`). Manual releases don't scale past the first one — versions drift from
the commit history, the changelog rots, and publishing depends on one person's laptop and
npm login. This task adopts the automation `docs/11-RELEASING.md` already plans for, so a
release is a merged PR, not a ritual.

## Outcome

Versioning, changelog, and publishing run from GitHub:

- **release-please** maintains a rolling release PR from Conventional Commit history
  (squash-merged PR titles): it bumps the version, updates `CHANGELOG.md`, and on merge
  tags `vX.Y.Z` and creates the GitHub Release.
- A **release workflow** triggers on that tag: build → pack-and-install smoke test →
  `npm publish` of `@mozartec/mos-cli` — publish never runs unsmoked.
- Publishing uses **npm trusted publishing** (OIDC from GitHub Actions, with provenance)
  so no long-lived npm token lives in repo secrets; if trusted publishing can't be
  configured (it's set per-package on npmjs after the package exists), a granular
  `NPM_TOKEN` secret is the documented fallback.
- One version line: the root app version and the CLI package version stay in lockstep,
  per `docs/11-RELEASING.md` ("the package version follows the app's SemVer").

## Context — read before starting

- [`docs/11-RELEASING.md`](../docs/11-RELEASING.md) — the plan this implements:
  release-please recommended, tag-triggered Release pipeline, beta/stable channels,
  SemVer 0.x. Update it to describe what was actually built.
- [`board/T-008-publish-cli.md`](T-008-publish-cli.md) — the manual publish flow and the
  smoke test (`bunx turbo run smoke --filter=@mozartec/mos-cli`) this pipeline reuses.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) ADR-012/ADR-014 — what is published
  (`@mozartec/mos-cli`, bin `mos`) and where (npmjs, public).
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — the CI job whose
  build/smoke steps the release workflow mirrors (Bun 1.3.14, Node 26).
- [`CHANGELOG.md`](../CHANGELOG.md) — hand-written Keep-a-Changelog file with a populated
  Unreleased section; release-please takes over its maintenance, so the first automated
  release must not discard those entries.

## Constraints (must honor)

- **Conventional Commits are the input.** PRs squash-merge with conventional titles
  (existing convention); the pipeline reads them — no manual version edits after this
  lands. Configure 0.x semantics (`bump-minor-pre-major`) so breaking changes bump minor
  while we're pre-1.0, per `docs/11-RELEASING.md`.
- **Never publish unsmoked** — the release workflow runs the same
  `turbo run smoke --filter=@mozartec/mos-cli` gate CI runs; a red smoke aborts publish.
- **No long-lived secrets if avoidable**: prefer trusted publishing + provenance; an
  `NPM_TOKEN` fallback must be a granular automation token scoped to the one package.
- **Verify current tool versions** (release-please action, npm/Node for OIDC support)
  when wiring — don't copy pinned versions from docs or memory unchecked.
- **Record the adoption as an ADR** (tool choice + auth model, one-line rationale each);
  `docs/11-RELEASING.md` is rewritten to match reality, replacing the "when automation
  lands" hedges.

## Plan

1. Add release-please (manifest config + GitHub workflow on pushes to `main`): single
   release tracking the root version, `extra-files` (or a manifest package entry) keeping
   `apps/cli/package.json` in lockstep; seed it with the current version and the existing
   CHANGELOG so Unreleased entries survive the first automated release PR.
2. Add the release workflow: on `v*` tag (release-please's merge product) — checkout,
   Bun + Node setup as in CI, build, smoke, `npm publish` from `apps/cli` with
   provenance; configure trusted publishing for `@mozartec/mos-cli` on npmjs (or wire the
   `NPM_TOKEN` fallback and say so in the docs).
3. Dry-run the loop on a branch: a `fix:`-titled squash merge produces a release PR with
   the right version bump and changelog section; the tag workflow runs green up to the
   publish step (publish itself exercised once against npm — a `0.1.x` patch is fine).
4. Update `docs/11-RELEASING.md` (automated flow, channels unchanged) and append the
   ADR; `bun run validate`.

## Acceptance

- [ ] Merging a conventionally-titled PR to `main` yields/updates a release PR with the
      correct 0.x version bump and changelog entry; the pre-existing hand-written
      CHANGELOG content is preserved beneath it.
- [ ] Merging the release PR tags `vX.Y.Z`, creates the GitHub Release, and the tag
      workflow publishes `@mozartec/mos-cli` to npmjs — observed end-to-end at least once
      (a real `0.1.x` publish).
- [ ] The publish step is gated on the pack-and-install smoke test in the same workflow
      run.
- [ ] Publishing authenticates via trusted publishing with provenance, or the documented
      `NPM_TOKEN` fallback — no broad-scope token in secrets either way.
- [ ] Root and `apps/cli` versions are identical after a release.
- [ ] `docs/11-RELEASING.md` describes the automated flow as built; the tool/auth
      decision is an ADR; `bun run validate` passes.

## Dependencies

- **Depends on:** T-008 (the package must exist on npmjs before trusted publishing can be
  configured and before automation has anything to version). **Blocks:** —

## Out of scope

Desktop/Tauri release artifacts (F-007), nightly builds (premature per
`docs/11-RELEASING.md`), publishing the skills or any second package, and changing the
release *content* (what ships is still the CLI tarball T-008 defined).

## References

ADR-012, ADR-014; `docs/11-RELEASING.md`; T-008.
