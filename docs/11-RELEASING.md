---
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T22:36:00Z
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

### Three things are versioned

1. **The app** — normal SemVer, tagged `vX.Y.Z`, published to npm by the release PR.
2. **The vault format (spec)** — versioned separately, because it's a contract other
   people's files depend on. The current spec version lives as `specVersion` in
   `.mos/config.json` and is noted at the top of [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md).
   Bump it **when the format change merges**, not when the app releases: the spec's
   consumers — this vault, adopter vaults, the skills — read `main`. What moves at app
   release is the *support claim*: `mos init`'s starter config
   ([`apps/cli/src/init.ts`](../apps/cli/src/init.ts)) stamps the spec version the
   released app supports, so update it deliberately alongside the format change the app
   ships.
3. **The skills** ([`skills/`](../skills/README.md)) — `version` in each `SKILL.md`'s
   metadata. They have no publish step: the skills CLI installs from GitHub `main`, so
   **a merge is a release**. Bump the version in the same PR that changes a skill's
   behavior.

### Version bumps must be visible in the changelog

release-please builds the changelog from squash-merge **titles**, and only `feat`/`fix`/
breaking titles appear — `docs`/`chore`/`ci` are invisible and trigger no release. A PR
that ships a live artifact bump is therefore never `docs:`: title it `feat(skills)` /
`fix(cli)` / `feat(core)` and put the new version in the title (e.g.
`feat(skills): ship-card 0.4.0 — self-review before finishing`). The changelog then
records the bump with no hand-editing, which the release PR forbids anyway.

## Changelog

`CHANGELOG.md` lives at the repository **root**. Up to `0.1.0` it was hand-maintained in
[Keep a Changelog](https://keepachangelog.com/) form; from `0.1.0` on, release-please
writes it (sections derived from Conventional Commit types). Don't edit it by hand —
the release PR owns it.

## Releasing (automated — ADR-015)

A release is **one merged PR**. The `Release` workflow
([`.github/workflows/release-please.yml`](../.github/workflows/release-please.yml)) runs
on every push to `main`:

1. **release-please** maintains a rolling release PR: version bump (root and
   `apps/cli/package.json` in lockstep) plus the changelog section, both computed from
   squash-merge commit titles since the last release tag. `feat`/`fix`/breaking commits
   feed it; `docs`/`chore`/`ci` alone trigger no release. Pre-1.0, breaking changes bump
   the **minor** (`bump-minor-pre-major`).
2. **Merging the release PR** tags `vX.Y.Z` and creates the GitHub Release.
3. The same workflow run then **publishes `@mozartec/mos-cli`**: build, the
   pack-and-install smoke test (same gate CI runs on every PR — a red smoke aborts the
   publish), then `npm publish` authenticated by **npm trusted publishing** (OIDC +
   provenance; no token in repo secrets).

To force a specific version, add a `Release-As: x.y.z` footer to a commit on `main`.

Manual publishing remains possible for emergencies (`bunx turbo run smoke
--filter=@mozartec/mos-cli && cd apps/cli && npm publish`) — never without the smoke
test, and expect to reconcile the version with release-please afterwards.

## Pipelines (GitHub Actions)

1. **CI** (`ci.yml`, task `T-003`): on every push and PR — build, lint, test, the packed
   CLI smoke test, vault validation.
2. **Release** (`release-please.yml`, ADR-015): release PR upkeep on every `main` push;
   tag + GitHub Release + npm publish on release-PR merge. Later it also builds and
   attaches the Tauri binaries.
3. **Nightly** (only once a binary exists): a scheduled (`cron`) build of `main` published
   as a rolling prerelease. Premature before desktop packaging.

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
3. **First usable build** *(done — `v0.1.0` shipped manually, then ADR-015 automated the
   loop)*: release-please + tag-and-publish on release-PR merge.
4. **Tauri binaries:** release workflow builds per-OS artifacts; add nightly prereleases;
   use the prerelease flag + `-beta`/`-rc` suffixes for channels.
