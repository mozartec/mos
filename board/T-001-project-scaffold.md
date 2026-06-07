---
id: T-001
type: task
title: Monorepo scaffold (Bun workspaces + Turbo, Angular 22 app)
status: In Progress
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# T-001 — Monorepo scaffold

> This card is the reference example of a "ready" card: a cold agent on any model should
> be able to execute it from this file plus the documents it links. See
> [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness.

## Outcome

After this task, the repo is a **Bun-workspaces monorepo orchestrated by Turbo**, with a
runnable Angular 22 app at `apps/web` (Tailwind + daisyUI styling), a pure `packages/core`
it consumes, and ESLint + Prettier + Vitest wired. The app shows empty Wiki and Board view
shells fed by a temporary static stub. **No real file reading, no markdown rendering, no
board logic** — just the skeleton everything else builds on.

## Context — read before starting

- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) — the monorepo layout
  (`apps/*`, `packages/*`), and the `VaultSource` interface (a pure type) that lives in
  `packages/core`.
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — exact stack: Angular 22, Tailwind +
  daisyUI, Bun, Turbo, Vitest, ESLint + Prettier.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-008 (monorepo: Bun + Turbo, not
  Nx), ADR-005 (stack), ADR-006 (web-first), ADR-001 (pure core), ADR-002 (read-only app).

## Constraints (must honor)

- **`packages/core` stays pure** — no Angular, no `fs`, no network imports; plain TS over
  strings/objects. (ADR-001)
- **No write/edit code anywhere** — the app is read-only. (ADR-002)
- **Do not let the monorepo tooling hijack Angular** — Turbo orchestrates scripts only;
  keep the standard `angular.json` and Angular CLI intact. No Nx. (ADR-008)
- Use **standalone components and signals**; enable zoneless if straightforward.
- Configure **daisyUI via Tailwind v4 CSS-first** (`@plugin "daisyui";` in the global
  stylesheet, `@tailwindcss/postcss` in `.postcssrc.json`).
- Create only the packages this task needs (`apps/web`, `packages/core`). Do **not**
  pre-create empty `apps/dev-server`, `mcp`, etc. — they come with their own tasks.

## Plan

1. **Workspace root:** add a root `package.json` with Bun workspaces
   `["apps/*", "packages/*"]`, and a `turbo.json` defining a pipeline for `build`, `lint`,
   `test`, `dev` (with `dependsOn: ["^build"]` where appropriate and sensible cache
   `outputs`). Add `.turbo/` to `.gitignore` (already present generically; confirm).
2. **`packages/core`:** a pure TS package (`bun init` style) exporting placeholder model
   types (`Card`, `VaultModel`) and the `VaultSource` interface
   (`listFiles()`, `readFile(path)`, `watch(cb)`). No framework, no I/O. Add a Vitest
   config and one passing sample test.
3. **`apps/web`:** scaffold Angular 22 here, e.g.
   `bunx @angular/cli@22 new web --standalone --routing --style=css` run inside `apps/`
   (confirm flags against the installed CLI). Wire it to depend on `packages/core` via the
   workspace.
4. **Tailwind v4 + daisyUI in `apps/web`:** install `tailwindcss @tailwindcss/postcss
   daisyui`; add `.postcssrc.json`; in the global stylesheet add `@import "tailwindcss";`
   and `@plugin "daisyui";`.
5. **App shell:** a layout with a daisyUI `Wiki | Board` toggle switching between empty
   `WikiView` and `BoardView` components. Add a `StaticVaultSource` (in
   `apps/web/src/sources`) implementing the `core` interface with a small hardcoded sample,
   so the UI renders before `apps/dev-server` exists (T-002).
6. **Tooling:** ESLint (angular-eslint) + Prettier across the workspace; Bun/Turbo scripts
   so `bun run dev|build|test|lint` at the root fan out via Turbo.

## Acceptance

- [ ] `bun install` at the root resolves the workspace.
- [ ] `bun run dev` (via Turbo) serves `apps/web`; the `Wiki | Board` toggle renders with
      daisyUI styling.
- [ ] `bun run test` runs Vitest; the `packages/core` sample test passes.
- [ ] `bun run lint` passes (angular-eslint + Prettier).
- [ ] `apps/web` imports and uses a symbol from `packages/core` (workspace wiring proven).
- [ ] `packages/core` contains zero Angular / `fs` / network imports.
- [ ] `angular.json` exists and is standard (no Nx takeover); Turbo only runs scripts.
- [ ] Only `apps/web` and `packages/core` were created; no empty placeholder packages.

## Dependencies

- **Depends on:** — (first task)
- **Blocks:** T-002 (adds `apps/dev-server` + `HttpVaultSource`), F-001–F-004.

## Out of scope

Real file reading/watching (T-002, T-004), Tauri packaging (T-005), markdown rendering
(F-003), board column logic (F-004), extra packages. Build only the workspace skeleton and
the app shell.

## References

ADR-001, ADR-002, ADR-005, ADR-006, ADR-008; `docs/03-ARCHITECTURE.md`,
`docs/04-TECH_STACK.md`.
