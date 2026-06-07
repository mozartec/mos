# Contributing to mos

Thanks for your interest. mos is early and built in public — the design and backlog are
all in this repo, so you can see exactly where it's going before writing any code.

## How the project is planned

mos is planned using its own format (we dogfood it):

- **Decisions** live in [`docs/08-DECISIONS.md`](docs/08-DECISIONS.md) as ADRs. If you
  want to understand *why* something is the way it is, start there.
- **The backlog** lives in [`board/`](board/) as cards (features `F-XXX`, stories
  `F-XXX-S-NN`, tasks `T-XXX`). Each card is a markdown file with frontmatter.
- **Scope** is in [`docs/06-MVP.md`](docs/06-MVP.md) and
  [`docs/07-ROADMAP.md`](docs/07-ROADMAP.md).

Please read [`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md) before adding or editing
cards or docs — it's the style guide for this repo.

## Ways to help right now

- **Discuss the design.** Open an issue if a decision in `08-DECISIONS.md` seems wrong
  or a part of `05-VAULT_SPEC.md` is unclear. The format is still settling.
- **Propose a feature.** Open an issue, or add a `Draft` feature card in `board/`
  following the conventions and open a PR.
- **Try the format.** Point your own markdown project at the spec and tell us where it
  breaks. The honest test of mos is whether the format fits real projects.

## Code (once scaffolding lands)

The first task is `T-001` (project scaffold). Until it's merged there's no app to run.
Planned developer setup:

```bash
bun install
bun run dev        # local web app against a configured vault
bun run test       # vitest, focused on the pure core
```

Code style is enforced by ESLint + Prettier; the core (`src/core`) must stay free of
I/O so it remains unit-testable and reusable. See
[`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md).

## Commits, versioning, and releases

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:`, …).
- Pull requests are merged with **squash merge**; the squash title is a Conventional
  Commit.
- Versioning is [SemVer](https://semver.org/); the project is `0.x` (unstable) for now.
- Note changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).

The full policy — branching, pipelines, release channels — is in
[`docs/11-RELEASING.md`](docs/11-RELEASING.md).

## Code of conduct

Be kind and constructive. Assume good faith. That's the whole policy for now.
