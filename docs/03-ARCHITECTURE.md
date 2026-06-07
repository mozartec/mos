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

mos is a **Bun-workspaces monorepo orchestrated by Turbo** (see ADR-008). The pure `core`
is a real package from day one because it's consumed by multiple apps; everything else is
an app under `apps/`. Packages and apps are added as they're needed, not pre-created empty.

```
mos/                      # monorepo root = also a mos vault (see below)
├── apps/
│   ├── web/              # Angular 22 app (the UI): core consumed, sources/ for adapters
│   ├── dev-server/       # Node fs server backing HttpVaultSource (added by T-002)
│   ├── desktop/          # Tauri shell (later, T-005)
│   ├── mcp/              # MCP write server (later, F-009)
│   └── vscode/           # VS Code extension (later, F-010)
├── packages/
│   └── core/             # pure TS: parseVault(files) → model, resolveLinks, buildBoard;
│                         #          also defines the VaultSource interface (a pure type)
├── turbo.json            # task pipeline + caching
├── package.json          # Bun workspaces: ["apps/*", "packages/*"]
└── .mos/  docs/  board/  examples/   # the repo is still a mos vault, at the root
```

Concrete `VaultSource` implementations (`HttpVaultSource`, the `StaticVaultSource` stub,
later `TauriVaultSource`) live in the app that uses them (`apps/web/src/sources`,
`apps/desktop`) — only the *interface* is in `packages/core`. A `packages/vault-source`
is extracted only if two apps end up sharing a concrete implementation.

Turbo runs `build` / `lint` / `test` / `dev` across the workspace with dependency-aware
ordering and caching, so changing `packages/core` rebuilds and retests only what depends
on it. The repo-as-vault files (`.mos/`, `docs/`, `board/`, `examples/`) sit at the root
and are unaffected by the workspace; `apps/**` and `packages/**` are excluded from the
wiki so package READMEs don't render as wiki pages.

### Inside an app (`apps/web/src`)

Organize `src/` by the **role** a thing plays, not by dumping everything into one folder —
and add a role-folder only when its first occupant exists (never pre-create empty ones, the
same rule we apply to packages). For `apps/web` today:

```
src/
├── app/                 # the root shell ONLY: bootstrap, app.config, app.routes, App
├── views/               # smart, routable screen components — what the user navigates
│   ├── wiki/            #   between; a view owns its data wiring and composes components
│   └── board/
├── sources/             # VaultSource adapters + the VAULT_SOURCE DI token (the I/O edge)
└── components/          # reusable presentational ("dumb") components, usable from any
                         #   view — created only when the first shared one exists
```

Roles, not buckets: `app/` holds the shell and nothing else; **views** are the smart
top-level screens (a view may be wired to a route or simply toggled); **components** are
dumb, reusable, and callable from anywhere; **sources** are the I/O adapters. A new role
(`services/`, `models/`, …) earns its own folder when it first appears, rather than being
crammed into an ill-fitting one — so we don't box ourselves, and we don't pre-create empty
folders either.

Keep a template/styles inline only while a component is tiny; once a template grows past a
few lines, move it to a sibling `*.html` (and `*.css` if it needs component styles), with
paths relative to the component's `.ts` file.

## Data flow

1. On launch the app loads `.mos/config.json` via the `VaultSource`.
2. It lists and reads the markdown files, hands their contents to `core`.
3. `core` parses frontmatter, builds the model, resolves links, and computes the board
   layout (each card's status mapped to a column by its type).
4. The UI renders the wiki tree and the board from that model.
5. When the `VaultSource` reports a file change, the affected file is re-parsed and the
   views update. (Writes come from the agent, not the app.)
