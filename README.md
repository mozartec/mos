# Markdown on Steroids (mos)

[![CI](https://github.com/mozartec/mos/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mozartec/mos/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mozartec/mos-cli)](https://www.npmjs.com/package/@mozartec/mos-cli)

> Your AI writes the tasks as markdown. You see them as a board.

**mos** is a local-first tool for solo developers. Your project plan lives as plain
markdown files in a folder you own. mos gives that folder two read-only views:

- **Wiki** — a file viewer with working links, so you can read and navigate your project without right-click-previewing every file in your editor.
- **Board** — a Kanban view of your features, stories, and tasks, grouped by status and sprint, so you can see at a glance what's planned, in progress, and done.

You don't edit tasks inside mos. You create and update them the way you already work
in 2026 — by asking an AI assistant, which edits the markdown for you (guided by an
`AGENTS.md` convention). mos just renders the result. The folder is the source of
truth; there is no database.

> **Status: early, but runnable.** The MVP is built — board, wiki, and dependency-graph
> lenses over any vault, served by the `mos` CLI, published to npm as
> [`@mozartec/mos-cli`](https://www.npmjs.com/package/@mozartec/mos-cli) (the badge above
> shows the current version). Building in public — follow along in [`board/`](board/).

## Why

Solo devs plan by talking to an AI and end up with a folder of markdown. That folder is
already a structured backlog — it just has no visual home. Heavy trackers (Jira, Linear)
mean copying your plan into a cloud database that drifts from your files. mos keeps the
files as truth and adds the one thing they lack: a board you can look at.

## How it works

```
your-project/
├── .mos/config.json   # what your card types, states, and columns are
├── docs/              # wiki pages (reference material)
└── board/             # cards: features, stories, tasks (markdown + frontmatter)
```

A file becomes a board card when it lives in the board folder **and** declares a
recognized `type` in its frontmatter. Everything else is wiki-only. The card types,
their states, and the board columns are all defined in `.mos/config.json` — nothing is
hardcoded, so mos fits any solo dev's conventions, not one fixed schema. See
[`docs/05-VAULT_SPEC.md`](docs/05-VAULT_SPEC.md) for the full format.

## Run it on your project

```bash
npx @mozartec/mos-cli init    # turn the current folder into a vault (Node ≥ 20)
npx @mozartec/mos-cli serve   # board + wiki at http://127.0.0.1:4400
```

mos never writes your files — `init` is a one-time scaffold, and serving is strictly
read-only. Your editor and your AI assistant do the writing. The full command reference
(`serve`, `init`, `validate`, flags) is the
[`@mozartec/mos-cli` readme](https://www.npmjs.com/package/@mozartec/mos-cli); the
step-by-step adoption walkthrough — config, scope, areas, skills, installing & upgrading —
is [`docs/12-ADOPTING.md`](docs/12-ADOPTING.md).

## This repo eats its own dog food

This repository **is** a mos vault. [`docs/`](docs/) is its wiki and [`board/`](board/)
is its live backlog, both following the format above. When the app exists, you'll be
able to open this very repo in it. That's the project's honesty test: if managing mos
with mos feels good, the idea works; if it doesn't, we'll find out here first.

## Tech stack

Angular 22 · Tailwind CSS · daisyUI · Vitest · ESLint + Prettier · Bun.
Packaged as a desktop app with Tauri later. A pure-TypeScript core (parsing, link
resolution, board layout) sits behind an I/O adapter so the same logic can power the
app, a future VS Code extension, and a future MCP server. See
[`docs/04-TECH_STACK.md`](docs/04-TECH_STACK.md).

## Documentation

[`docs/00-README.md`](docs/00-README.md) is the documentation index, with the full
reading order. Good entry points: [`01-VISION`](docs/01-VISION.md) (what we're building
and for whom), [`05-VAULT_SPEC`](docs/05-VAULT_SPEC.md) (the vault format — the data
contract), and [`12-ADOPTING`](docs/12-ADOPTING.md) (using mos in your own project).

## Try the format

A small, generic example vault lives in [`examples/recipe-box`](examples/recipe-box) —
a non-mos project, to show the format isn't tied to this codebase.

## Agent skills

This repo ships first-party, vault-agnostic agent skills for working a mos board —
`mos-next-card` (recommend what to work on next), `mos-ship-card` (take one card to an
open PR), and `mos-refine-batch` (reshape the backlog so parallel-safe work exists).
Install them into any project with the [`skills`](https://github.com/vercel-labs/skills)
CLI:

```bash
npx skills add mozartec/mos
```

What each skill does, the authoring rules, and how installed copies relate to
`.agents/skills/` are documented in [`skills/README.md`](skills/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is planned in the open: the backlog
is in `board/`, the rationale is in `docs/08-DECISIONS.md`.

## License

[MIT](LICENSE) © mozartec
