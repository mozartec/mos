# Architecture

## One rule above all

**The core is pure; all I/O lives at the edges.** Parsing markdown, resolving links, and
laying out the board are deterministic functions over file *contents* — no filesystem, no
framework. Reading and watching files is a thin adapter the rest of the app talks to
through one interface. This keeps the valuable logic testable in isolation and reusable
by things that aren't the desktop app (a future VS Code extension, a future MCP server).

## Layers

```
   READ PATH (the app)                 WRITE PATH (the agent)
┌──────────────────────────┐      ┌──────────────────────────────┐
│  Angular UI (Wiki, Board) │      │  AI assistant (you, chatting) │
└────────────┬─────────────┘      │      ▼                        │
             │ calls              │  AGENTS.md convention (MVP)   │
┌────────────▼─────────────┐      │  MCP server (later, optional) │
│  core/  (pure TypeScript) │      └───────────────┬──────────────┘
│  parse · resolve · board  │                      │ writes frontmatter only
└────────────┬─────────────┘                      │
             │ VaultSource interface              │
┌────────────▼──────────────────────────────────────▼─────────────┐
│  Markdown files + frontmatter  (SOURCE OF TRUTH)                 │
│  .mos/  config + cache (rebuildable)   ·   git (history)         │
└──────────────────────────────────────────────────────────────────┘
```

## The VaultSource adapter

The UI never reads the disk directly. It depends on a small interface:

```ts
interface VaultSource {
  listFiles(): Promise<string[]>;
  readFile(path: string): Promise<string>;
  watch(onChange: (path: string) => void): () => void; // returns an unsubscribe fn
}
```

There will be two implementations:

- **`HttpVaultSource`** (development) — talks to a tiny Node dev server that reads the
  configured folder and streams change events. Lets us run the whole UI with `bun run dev`
  and no packaging.
- **`TauriVaultSource`** (desktop) — calls Tauri commands backed by Rust filesystem access
  and a native file watcher.

Swapping one for the other changes nothing in the UI or the core. This is why starting as
a local web app is not throwaway work.

## Project structure

```
src/
├── core/        # pure TS: parseVault(files) → model, resolveLinks, buildBoard(model, config)
├── sources/     # VaultSource implementations (http now, tauri later)
├── ui/          # Angular components: WikiView, BoardView, Card, FileTree, Reader
└── main.ts
server/          # dev-only Node fs server (read + watch)
examples/        # demo vaults
src-tauri/       # (added when we package for desktop)
```

`core/` is promoted to its own package only when the MCP server needs to import it — not
before, to avoid premature monorepo ceremony.

## Data flow

1. On launch the app loads `.mos/config.json` via the `VaultSource`.
2. It lists and reads the markdown files, hands their contents to `core`.
3. `core` parses frontmatter, builds the model, resolves links, and computes the board
   layout (each card's status mapped to a column by its type).
4. The UI renders the wiki tree and the board from that model.
5. When the `VaultSource` reports a file change, the affected file is re-parsed and the
   views update. (Writes come from the agent, not the app.)
