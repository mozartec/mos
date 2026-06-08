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
apps/        the apps: web/ (Angular), later dev-server/, desktop/, mcp/, vscode/
packages/    shared packages: core/ (pure TS) — added as needed
scripts/     repo scripts (e.g. validate-vault.mjs)
```

This is a Bun-workspaces monorepo run by Turbo (ADR-008). The pure `packages/core` is the
shared logic; I/O lives in the apps.

## Code & workflow conventions

- Stack: TypeScript, Angular 22, Tailwind + daisyUI, Bun, ESLint + Prettier, Vitest.
  Details: [`docs/04-TECH_STACK.md`](docs/04-TECH_STACK.md),
  architecture: [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md).
- Commits follow Conventional Commits; PRs squash-merge; SemVer (0.x).
  See [`docs/11-RELEASING.md`](docs/11-RELEASING.md).
- Spec/card/ADR style: [`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md).

## Agent skills

A **turborepo** skill is installed at `.agents/skills/turborepo/` — use it for monorepo,
Turbo, caching, and internal-package questions (e.g. before editing `turbo.json` or a
package's `exports`). Angular and daisyUI skills live in [`apps/web`](apps/web/AGENTS.md).

First-party **mos** skills live under [`.agents/skills/mos/`](.agents/skills/mos/SKILL.md) —
skills for operating this (or any) mos vault. Use
[`mos/next-task`](.agents/skills/mos/next-task/SKILL.md) when asked what to work on next or to
start the next task/story/card; it ranks the board and recommends a pick. New mos skills are
added as sibling folders there.

## Nested guidance (scoped instructions)

Some folders carry their own `AGENTS.md` for context-specific rules; use the nearest one
in addition to this file:

- [`apps/web/AGENTS.md`](apps/web/AGENTS.md) — Angular/TypeScript conventions when working
  in the web app (shipped by the Angular CLI).
- [`examples/recipe-box/AGENTS.md`](examples/recipe-box/AGENTS.md) — what a standalone user
  vault's agent guide looks like.

`AGENTS.md` is the single source of truth at each level. The sibling `CLAUDE.md` and
`.github/copilot-instructions.md` files do not duplicate it — they import it (Claude's
`@import`) or instruct the tool to read it.

## Managing this repo's backlog

Because this repo is also a vault, you may be asked to add or update **cards** in
`board/`. The rules (frontmatter only, never rewrite prose, allowed types/states) are in
[`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md). When you **create** a card or doc set its
`created` and `updated` timestamps; when you **edit** frontmatter, bump `updated` (the app
never writes these — see [`docs/09-CONVENTIONS.md`](docs/09-CONVENTIONS.md) §Timestamps and
ADR-010). After changing cards, run `bun run validate` (or `node scripts/validate-vault.mjs`)
to confirm every card still maps to a column and parents resolve — it's the cheap check that
the board renders as intended.
