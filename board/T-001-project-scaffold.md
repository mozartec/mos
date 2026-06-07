---
id: T-001
type: task
title: Project scaffold (Angular 22 + Tailwind + daisyUI, Bun)
status: In Progress
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# T-001 — Project scaffold

> This card is the reference example of a "ready" card: a cold agent on any model should
> be able to execute it from this file plus the documents it links. See
> [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness.

## Outcome

After this task, the repo contains a runnable Angular 22 app shell — Tailwind + daisyUI
styling, ESLint + Prettier, and Vitest wired — with empty Wiki and Board view shells and a
`VaultSource` interface plus a temporary static stub. **No real file reading, no markdown
rendering, no board logic** — just the skeleton everything else builds on.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) — the project structure
  (`src/core`, `src/sources`, `src/ui`, `server/`) and the `VaultSource` interface you will
  define here as an empty contract.
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — exact stack and why (Angular 22,
  Tailwind + daisyUI, Bun, Vitest, ESLint + Prettier).
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-005 (stack), ADR-006 (web-first),
  ADR-001 (pure core), ADR-002 (read-only app).

## Constraints (must honor)

- **`src/core` stays pure** — no Angular, no `fs`, no network imports. (ADR-001)
- **No write/edit code anywhere** — the app is read-only. (ADR-002)
- Use **standalone components and signals**; enable zoneless if it's straightforward.
- Configure **daisyUI via Tailwind v4 CSS-first** (`@plugin "daisyui";` in the global
  stylesheet, `@tailwindcss/postcss` in `.postcssrc.json`).

## Plan

1. Scaffold an Angular 22 workspace at the repo root using Bun, e.g.
   `bunx @angular/cli@22 new mos --standalone --routing --style=css --package-manager=bun`
   (confirm flags against the installed CLI version).
2. Create the structure from the architecture doc:
   - `src/core/` — pure TS; add `index.ts` and placeholder model types (`Card`, `VaultModel`).
   - `src/sources/` — define `interface VaultSource { listFiles(); readFile(path); watch(cb); }`
     plus a `StaticVaultSource` that returns a small hardcoded sample, so the UI renders
     before T-002 exists.
   - `src/ui/` — `WikiView` and `BoardView` shell components (empty placeholders).
3. Tailwind v4 + daisyUI: install `tailwindcss @tailwindcss/postcss daisyui`; add
   `.postcssrc.json`; in the global stylesheet add `@import "tailwindcss";` and
   `@plugin "daisyui";`.
4. Tooling: configure ESLint (angular-eslint) + Prettier; set up Vitest for `src/core` with
   one passing sample test; add Bun scripts: `dev`, `build`, `test`, `lint`.
5. App shell: a layout with a daisyUI `Wiki | Board` toggle switching between the two empty
   view shells. No data logic beyond the `StaticVaultSource` stub.

## Acceptance

- [ ] `bun install` succeeds.
- [ ] `bun run dev` serves the app; the `Wiki | Board` toggle renders with daisyUI styling.
- [ ] `bun run test` runs Vitest and the sample `src/core` test passes.
- [ ] `bun run lint` passes (angular-eslint + Prettier).
- [ ] `src/core` contains zero Angular / `fs` / network imports.
- [ ] `VaultSource` interface exists; `StaticVaultSource` returns sample data; no real
      filesystem access anywhere.

## Dependencies

- **Depends on:** — (first task)
- **Blocks:** T-002 (needs the `VaultSource` interface and view shells), F-001–F-004.

## Out of scope

Real file reading/watching (T-002, T-004), Tauri packaging (T-005), markdown rendering
(F-003), board column logic (F-004). Build only the shell.

## References

ADR-001, ADR-002, ADR-005, ADR-006; `docs/03-ARCHITECTURE.md`, `docs/04-TECH_STACK.md`.
