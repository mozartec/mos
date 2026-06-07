# Tech stack

The hard parts of mos are parsing and rendering markdown and laying out a board. None of
that needs a heavy framework, a database, or a state-management library. The stack is
chosen for a solo developer's velocity first, with an eye on the open-source future.

## Choices

| Area | Choice | Why |
|---|---|---|
| Language | **TypeScript** | One language across core, UI, dev server, and a future MCP server. |
| UI framework | **Angular 22** | Strict, structured, DI-driven — a natural fit for a TypeScript/C#-minded developer, and the maintainer is most productive in it. Signals suit the live-reload reactivity. |
| Styling | **Tailwind CSS** | Utility-first, fast to move in, no bespoke CSS system to maintain. |
| Components | **daisyUI** | A Tailwind plugin giving good-looking buttons, cards, badges, inputs, and a light/dark theme system with near-zero integration cost. Pure CSS, so it's removable. |
| Behavior | **Angular CDK** (later) | Added when the UI outgrows native `<select>`/`<dialog>` — overlays, focus management, drag-and-drop, virtual scroll. Not needed for the read-only MVP. |
| Bundler / dev server | **Vite** (via Angular CLI) | Fast dev loop; the dev filesystem server hangs off it via a proxy. |
| Package manager | **Bun** | Fast installs and scripts; also provides the workspace. |
| Monorepo | **Bun workspaces + Turbo** | The pure `core` is shared by the app, a future MCP server, and a VS Code extension — a real multi-package setup. Turbo orchestrates build/lint/test/dev across packages with caching, while staying out of the way. (Nx rejected — it wraps `angular.json` and the CLI; see ADR-008.) |
| Tests | **Vitest** | Runs against the pure `core` with in-memory fixtures; component tests use Angular's harness. |
| Lint / format | **ESLint (angular-eslint) + Prettier** | angular-eslint covers template rules that an all-in-one formatter doesn't. |
| Icons | **Tabler** | One consistent, MIT-licensed SVG set; clean developer-tool look, no mixing of icon libraries. (ADR-009, set up in T-006.) |
| Typography | **Inter + JetBrains Mono**, self-hosted via **Fontsource** | Inter for UI, JetBrains Mono for code/ids; self-hosted (offline, no CDN/FOUT), wired as Tailwind `--font-*` tokens so a future font picker is cheap. (ADR-009.) |
| Desktop packaging | **Tauri** (later) | Small native binary, low memory, native filesystem access and file watching — better than Electron for a local-first dev tool. |

## Explicitly deferred

- **Zard UI** — a shadcn-style component set on Tailwind + CDK + Signals. The most natural
  long-term fit for this stack, but still in beta; we start simpler with daisyUI and adopt
  Zard only if and when we want prebuilt accessible components we own.
- **Angular Material** — most complete, but its Material Design aesthetic fights the dense,
  bespoke look a board/wiki tool wants, and its theming is a learning curve we're not
  taking on alongside a first Angular 22 + Tauri build.

## A note on the core

`packages/core` imports no framework and touches no filesystem. It's plain functions over
strings and objects. That discipline is what lets the same logic serve the Angular app
today and a VS Code extension or MCP server tomorrow. See
[`03-ARCHITECTURE.md`](03-ARCHITECTURE.md).
