---
created: 2026-06-07T13:00:00Z
updated: 2026-06-07T13:00:00Z
---

# Releasing: branching, commits, versioning, and pipelines

How this project handles git workflow, versioning, and releases. It's written to be a
practical reference — and, since mos is a solo project built in public, it's deliberately
staged: adopt each practice when it starts paying for itself, not before.

## Branching

- **While docs/planning (now):** commit directly to `main`. PRs for one-line doc edits are
  pure overhead.
- **Once there is code + CI:** short-lived feature branches → pull request → merge. Even
  solo, the PR is what runs CI before code hits `main` and keeps history clean. This is
  "trunk-based development." Avoid long-lived branches and gitflow.
- **Branch protection on `main`** (enable when CI exists): require status checks to pass,
  block force-pushes. Do **not** require approvals — that would block a solo maintainer.

## Commit messages — Conventional Commits

Every commit message follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <summary>

<optional body>
<optional footer>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.
Breaking changes use a `!` (`feat!: ...`) or a `BREAKING CHANGE:` footer.

Examples:

```
feat(board): group cards into columns by type state map
fix(parser): tolerate frontmatter with trailing whitespace
docs: add vault spec section on link resolution
```

Why: a machine-readable history lets us automate the changelog and version bumps later.
Start the habit now; enforcement tooling (commitlint) can come later if discipline slips.

## Merging — squash

Pull requests are merged with **squash merge**, so each PR becomes one clean commit on
`main`. Make the squash commit's title a Conventional Commit — that one line is what
release tooling reads. (A PR-title lint action can enforce this once PRs are in use.)

## Versioning — Semantic Versioning

`MAJOR.MINOR.PATCH`:

- **MAJOR** — incompatible/breaking changes.
- **MINOR** — backward-compatible features.
- **PATCH** — backward-compatible fixes.

**Pre-1.0:** while the version is `0.y.z`, the API is explicitly unstable. We bump the
minor for features and the patch for fixes, and breaking changes are allowed in minor
bumps. We reach **1.0.0** only when we're ready to promise stability — i.e., when breaking
the app or the vault format would meaningfully hurt users we don't want to hurt. There is
no rush to 1.0.

### Two things are versioned

1. **The app** — normal SemVer, tagged `vX.Y.Z`.
2. **The vault format (spec)** — versioned separately, because it's a contract other
   people's files depend on. The current spec version lives as `specVersion` in
   `.mos/config.json` and is noted at the top of [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md).
   Bump it only when the format changes; the app states which spec versions it supports.

## Changelog

`CHANGELOG.md` lives at the repository **root** and follows
[Keep a Changelog](https://keepachangelog.com/): an `## [Unreleased]` section at the top
that we append to as work merges, with `Added / Changed / Deprecated / Removed / Fixed /
Security` subsections. On release, the Unreleased items move under a new dated version
heading. Hand-maintained for now; automated later (see below).

## Pipelines (GitHub Actions)

Added in stages:

1. **CI** (with the first code — task `T-003`): on every push and PR, run
   `build → lint → test` on Bun. This is what makes PR-based merging worthwhile.
2. **Release** (when cutting `v0.1.0`): triggered by a version tag (or a release-PR merge);
   creates the GitHub Release. Later it also builds and attaches the Tauri binaries.
3. **Nightly** (only once a binary exists): a scheduled (`cron`) build of `main` published
   as a rolling prerelease. Premature before desktop packaging.

### Automating releases

When we start cutting real releases, adopt a tool that reads Conventional Commits and
handles versioning + changelog + GitHub Release. **release-please** is the recommended fit
for this project (it opens a "release PR" that bumps the version and updates
`CHANGELOG.md`, then tags and releases on merge). Alternatives: semantic-release (fully
automatic) and changesets. Verify current versions when wiring one up.

## Release channels — beta vs stable

Two mechanisms work together:

- **SemVer prerelease suffixes** name the build: `v0.2.0-beta.1`, `v1.0.0-rc.1`.
- **GitHub Releases' "prerelease" flag** keeps betas and nightlies from being marked
  "Latest".

So: **stable** = `vX.Y.Z` (not prerelease); **beta/rc** = suffixed and flagged prerelease;
**nightly** = scheduled and flagged prerelease. When Tauri's auto-updater is added, it can
point at whichever channel.

## The staged rollout, in order

1. **Now (docs only):** commit to `main`; write Conventional Commits; maintain root
   `CHANGELOG.md` (`0.1.0` / Unreleased). No CI.
2. **`T-001` + `T-003`:** feature branches → squash-merge PRs; branch protection (CI
   required, no force-push, no required reviews); CI runs build + lint + test.
3. **First usable build:** adopt release-please; tag `v0.1.0`; first GitHub Release.
4. **Tauri binaries:** release workflow builds per-OS artifacts; add nightly prereleases;
   use the prerelease flag + `-beta`/`-rc` suffixes for channels.
