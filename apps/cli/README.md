# @mozartec/mos-cli

**mos** (markdown on steroids) renders a folder of markdown as a wiki and a Kanban board.
The folder is the source of truth; the app is strictly read-only — your editor and your
AI agent do the writing.

Requires Node ≥ 20.

## Quick start

```bash
npx @mozartec/mos-cli init    # turn the current folder into a vault
npx @mozartec/mos-cli serve   # board + wiki at http://127.0.0.1:4400
```

Or install globally for a plain `mos` command:

```bash
npm i -g @mozartec/mos-cli
mos init && mos serve
```

## Commands

| Command | What it does |
| --- | --- |
| `mos serve [dir] [--port <n>]` | Serve the vault at `dir` (default: the nearest vault at or above the current directory). Live-reloads on file changes. |
| `mos init [dir]` | Scaffold a vault: starter `.mos/config.json`, one example card, an `AGENTS.md` write guide. One-time bootstrap — refuses to touch an existing vault. |
| `mos --version` / `mos --help` | Version / usage. |

## What a vault is

Any folder containing `.mos/config.json`. Markdown files under `board/` whose frontmatter
declares a configured `type` are cards on the board; the rest of the folder renders as a
wiki. Card types, states, and columns all come from the config — nothing about your
vocabulary is hardcoded. Internal links (id references like `T-001` and ordinary relative
markdown links) navigate in-app, and the same files render unchanged on GitHub.

The full format contract, the architecture, and the agent-driven write convention live in
the [mos repository](https://github.com/mozartec/mos) — start with
[`docs/12-ADOPTING.md`](https://github.com/mozartec/mos/blob/main/docs/12-ADOPTING.md).

## Read-only by design

`mos serve` has no write endpoint and rejects non-GET requests; `init` never overwrites a
file. Every change to your vault happens through your editor or your AI assistant.

## License

[MIT](https://github.com/mozartec/mos/blob/main/LICENSE)
