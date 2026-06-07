# Markdown on Steroids (mos)

> Your AI writes the tasks as markdown. You see them as a board.

**mos** is a local-first tool for solo developers. Your project plan lives as plain
markdown files in a folder you own. mos gives that folder two read-only views:

- **Wiki** — a file viewer with working links, so you can read and navigate your project without right-click-previewing every file in your editor.
- **Board** — a Kanban view of your features, stories, and tasks, grouped by status and sprint, so you can see at a glance what's planned, in progress, and done.

You don't edit tasks inside mos. You create and update them the way you already work
in 2026 — by asking an AI assistant, which edits the markdown for you (guided by an
`AGENTS.md` convention). mos just renders the result. The folder is the source of
truth; there is no database.

> **Status: early / planning.** There is no runnable app yet. This repository
> currently contains the design, the format spec, and the live backlog. Building in
> public — follow along in [`board/`](board/).

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

## Try the format

A small, generic example vault lives in [`examples/recipe-box`](examples/recipe-box) —
a non-mos project, to show the format isn't tied to this codebase.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is planned in the open: the backlog
is in `board/`, the rationale is in `docs/08-DECISIONS.md`.

## License

[MIT](LICENSE) © mozartec
