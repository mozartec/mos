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

Stand up the app shell: Angular 22 workspace via Bun, Tailwind + daisyUI configured for
Tailwind v4 (CSS-first `@plugin "daisyui"`), ESLint + Prettier, Vitest wired for the core.
A folder picker and empty Wiki/Board view slots. No domain logic yet.

## Acceptance
- `bun install` and `bun run dev` start the app.
- `bun run test` runs Vitest; `bun run lint` passes.
- Tailwind + daisyUI classes render.
