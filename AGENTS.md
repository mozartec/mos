# AGENTS.md — working in the mos project

You are an AI assistant working on **Markdown on Steroids (mos)**. This file is your
entry point. Read it first, every session — it assumes you remember nothing.

mos is a local-first tool that renders a folder of markdown as a wiki and a Kanban board.
The folder is the source of truth; the app is read-only; writes happen via the agent
layer. (One-paragraph version; the full story is [`docs/01-VISION.md`](docs/01-VISION.md).)

## This repo is two things at once

- A **codebase** — the mos app (once code lands, under `src/`).
- A **mos vault** — it manages its own backlog in its own format: `docs/` is the wiki,
  `board/` is the backlog, `.mos/config.json` is the vault config. We dogfood.

## How to work here

1. **Get oriented:** read this file, then [`docs/00-README.md`](docs/00-README.md) for the
   map of the documentation.
2. **When asked to work on a task** (e.g. "work on T-001"): open its card at
   `board/<ID>-*.md`. The card is written to be self-sufficient — it lists the exact docs
   and ADRs to read, the constraints to honor, a step plan, and an acceptance checklist.
   Do **only** what the card scopes. If the card is missing any of that, it isn't ready —
   say so instead of guessing.
3. **Honor the constraints below.** They are non-negotiable and enforced in review.
4. **Check acceptance** before declaring done.

## Non-negotiable constraints

- **The core is pure.** `src/core` imports no framework, no filesystem, no network — only
  plain TypeScript over strings/objects. (ADR-001, see [`docs/08-DECISIONS.md`](docs/08-DECISIONS.md))
- **The app is read-only.** Never add code that writes/edits/creates vault files. Writes
  are the agent layer's job. (ADR-002)
- **Config-driven, never hardcoded.** Card types, states, and columns come from
  `.mos/config.json`. (ADR-003)
- **The folder is the source of truth.** No database; `.mos/` holds only rebuildable
  cache. (ADR-001)

## Where things are

```
docs/        the documentation (start at 00-README.md)
board/       the backlog as cards (features F-, stories F-..-S-, tasks T-)
examples/    demo vaults (e.g. recipe-box) — also where the per-vault AGENTS.md lives
src/         the app (added by T-001): core/ (pure), sources/ (I/O adapter), ui/ (Angular)
```

## Code & workflow conventions

- Stack: TypeScript, Angular 22, Tailwind + daisyUI, Bun, ESLint + Prettier, Vitest.
  Details: [`docs/04-TECH_STACK.md`](docs/04-TECH_STACK.md),
  architecture: [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md).
- Commits follow Conventional Commits; PRs squash-merge; SemVer (0.x).
  See [`docs/11-RELEASING.md`](docs/11-RELEASING.md).
- Spec/card/ADR style: [`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md).

## Managing this repo's backlog

Because this repo is also a vault, you may be asked to add or update **cards** in
`board/`. The rules (frontmatter only, never rewrite prose, allowed types/states) are in
[`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md). For what a standalone user vault's
agent guide looks like, see [`examples/recipe-box/AGENTS.md`](examples/recipe-box/AGENTS.md).
