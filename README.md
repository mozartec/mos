# Markdown on Steroids (mos)

[![CI](https://github.com/mozartec/mos/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mozartec/mos/actions/workflows/ci.yml)

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
> lenses over any vault, served by the `mos` CLI — and not yet published to npm; the
> first tagged release will be `v0.1.0`. Building in public — follow along in
> [`board/`](board/).

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

The CLI bundles the built web app and a read-only file server in one Node ≥ 20 process
(see [`docs/12-ADOPTING.md`](docs/12-ADOPTING.md)):

```bash
mos init           # turn the current folder into a vault: starter config,
                   # example card, AGENTS.md write rules (refuses on an existing vault)
mos serve          # board + wiki at http://127.0.0.1:4400, live-reloading on file changes
```

Once the package is on npm this is `npx @mos/cli init` / `npx @mos/cli serve`. Until
then, run it from a clone:

```bash
bun install && bunx turbo run build --filter=@mos/cli
node apps/cli/bin/mos.mjs serve <your-vault-dir>
```

mos never writes your files — `init` is a one-time scaffold, and serving is strictly
read-only. Your editor and your AI assistant do the writing.

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

| Doc | What it covers |
|---|---|
| [01-VISION](docs/01-VISION.md) | What we're building and for whom |
| [02-CONCEPTS](docs/02-CONCEPTS.md) | The mental model: vault, card, type, lens |
| [03-ARCHITECTURE](docs/03-ARCHITECTURE.md) | Core library, I/O adapter, app shape |
| [04-TECH_STACK](docs/04-TECH_STACK.md) | Stack and the reasoning behind it |
| [05-VAULT_SPEC](docs/05-VAULT_SPEC.md) | The vault format (the data contract) |
| [06-MVP](docs/06-MVP.md) | What the first version is — and isn't |
| [07-ROADMAP](docs/07-ROADMAP.md) | Phases and future ideas |
| [08-DECISIONS](docs/08-DECISIONS.md) | Architecture decision records |
| [09-CONVENTIONS](docs/09-CONVENTIONS.md) | How we write docs, cards, and ADRs |
| [10-GLOSSARY](docs/10-GLOSSARY.md) | Terminology |
| [11-RELEASING](docs/11-RELEASING.md) | Branching, versioning, publishing |
| [12-ADOPTING](docs/12-ADOPTING.md) | Using mos in your own project (CLI + skills) |

## Try the format

A small, generic example vault lives in [`examples/recipe-box`](examples/recipe-box) —
a non-mos project, to show the format isn't tied to this codebase.

## Agent skills

This repo ships first-party agent skills for working a mos board, authored in
[`skills/`](skills/README.md) in the standard installable layout:

- **`next-card`** — ask your agent what to work on next; it ranks the board (priority,
  sprint, dependencies, in-progress first) and recommends one card with reasoning.
- **`ship-card`** — point it at a card id (any type your config defines — feature, story,
  task, …) and it takes that card to an open PR: plan, raise doubts, branch, build, commit,
  push.

Both are vault-agnostic: they read your types, states, columns, and sprints from
`.mos/config.json` at run time and refuse to start without it — nothing about this repo's
vocabulary is hardcoded. Install them into any project with the
[`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add mozartec/mos
```

That drops the skills into the target project's `.agents/skills/` and links them into the
agent-native locations (e.g. `.claude/skills/` for Claude Code), so the agent can trigger
them by description or you can invoke them explicitly.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is planned in the open: the backlog
is in `board/`, the rationale is in `docs/08-DECISIONS.md`.

## License

[MIT](LICENSE) © mozartec
