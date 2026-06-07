# Decisions (ADRs)

Architecture Decision Records. Append-only: to change a decision, add a new ADR that
supersedes the old one and mark the old one `Superseded`.

## ADR-001 — The markdown folder is the source of truth; no database

**Status:** Accepted · **Date:** 2026-06-07

**Context.** mos manages a project plan that already exists as markdown. A database would
duplicate that data and inevitably drift from the files.

**Decision.** The folder of markdown is the single source of truth. mos holds only
rebuildable cache and UI state (in `.mos/`), never authoritative data. Git provides
history and audit for free.

**Consequences.** Human-readable diffs; no sync layer; nothing to migrate. The cost is
that all "queries" are computed by parsing files on load — fine at solo-dev scale.

## ADR-002 — The app is read-only; writes happen in the agent layer

**Status:** Accepted · **Date:** 2026-06-07

**Context.** Solo devs already create and change tasks by talking to an AI. Building an
edit UI duplicates that and introduces the one genuinely risky operation — mutating files.

**Decision.** The app only reads. Cards are created and updated by an AI assistant guided
by the vault's `AGENTS.md`, and (later, optionally) by an MCP server that centralizes safe
frontmatter writes. Edits touch frontmatter only, never prose.

**Consequences.** The riskiest code is isolated and optional, not in the shipped app. The
trade-off is that day-one users need an assistant to change the board. In-app editing
remains a future option (ADR can be superseded).

## ADR-003 — A card is folder scope + a recognized frontmatter `type`

**Status:** Accepted · **Date:** 2026-06-07

**Context.** We need to tell board items apart from plain wiki docs, and we don't want to
hardcode one project's naming (e.g. `F-`/`T-` prefixes).

**Decision.** A file is a card when it's inside a configured board folder **and** declares
a `type` defined in `.mos/config.json`. The type also defines the card's states, parent
rule, and displayed fields — so "is this a card?" and "how does it behave?" are one
mechanism. Identity is the `id`, not the path.

**Consequences.** Robust to renames; not locked to any project's conventions; one config
drives everything. A stray typed file in the board folder becomes a card, which we mitigate
by reporting unrecognized files rather than hiding them.

## ADR-004 — Two independent lenses: wiki and board

**Status:** Accepted · **Date:** 2026-06-07

**Decision.** mos is a wiki (file viewer + navigation) and a board (Kanban), sharing one
markdown renderer but otherwise independent. Neither requires the other.

**Consequences.** Each lens is small and shippable on its own; the board is the MVP, the
wiki is the reading surface behind it.

## ADR-005 — Stack: Angular 22 + Tailwind + daisyUI, pure-TS core, Tauri later

**Status:** Accepted · **Date:** 2026-06-07

**Context.** The maintainer is most productive in Angular (TypeScript/C#-minded). The
app's heavy libraries (markdown parsing) are framework-agnostic, so the "React has more
packages" argument barely applies, and the read-only board needs no drag-and-drop library.

**Decision.** Angular 22, Tailwind, daisyUI for V1 styling (Zard and Angular Material
deferred), Vitest, ESLint + Prettier, Bun. A pure-TypeScript `core` behind a `VaultSource`
I/O adapter. Start as a local web app; package with Tauri afterward.

**Consequences.** Fast solo velocity and an enjoyable build; the pure core stays reusable
by a future VS Code extension and MCP server. If the project attracts contributors, the
Angular pool is smaller than React's — accepted, since velocity-now outweighs hypothetical
contributors.

## ADR-006 — Start as a local web app, package with Tauri later

**Status:** Accepted · **Date:** 2026-06-07

**Decision.** Build first as a web app (Angular dev server + a small Node filesystem
server) so we can iterate on the views with no packaging. Add a Tauri build once the views
are right, swapping only the `VaultSource` implementation.

**Consequences.** Fastest path to looking at a real vault; no throwaway work because the
UI and core are unchanged by the swap.

## ADR-007 — The repository is the memory; cards target cold, any-model agents

**Status:** Accepted · **Date:** 2026-06-07

**Context.** AI collaboration is productive in a long first session where context lives in
the chat, but breaks in later sessions — especially in an editor on a cheaper model — that
start with no memory. Relying on the agent to re-derive context is expensive and unreliable.

**Decision.** Make the repository the durable memory and treat sessions as disposable.
Concretely:

- A root **`AGENTS.md`** is the single entry point for working in the project — a small map
  that orients an agent and routes it to the right place. A **`CLAUDE.md`** stub points to
  it for tools that don't read `AGENTS.md` natively.
- A separate, self-contained **vault `AGENTS.md`** (shipped in every vault, e.g.
  `examples/recipe-box/AGENTS.md`) tells agents how to manage that vault's cards. The two
  files have distinct jobs: "how to build the project" vs "how to manage a vault."
- Every backlog **card meets the cold-start standard** in
  [`09-CONVENTIONS.md`](09-CONVENTIONS.md): a cold mid-tier agent can execute it from the
  card plus its linked docs, with explicit context, constraints, plan, acceptance,
  dependencies, and out-of-scope.
- Context is **layered** (entry file → docs → card), so an agent reads only what its task
  needs, bounding token cost and keeping cheaper models reliable.

**Consequences.** Work becomes model- and session-agnostic; you can use a cheaper model for
most tasks and reserve stronger models for genuinely ambiguous work. The cost is authoring
discipline: cards take more effort to write to the ready standard, and `AGENTS.md` plus the
docs must be kept current. This discipline is also a product principle — mos is, in part, a
tool for working this way, and could later help author and validate ready cards.

## ADR-008 — Monorepo with Bun workspaces + Turbo (not Nx)

**Status:** Accepted · **Date:** 2026-06-07

**Context.** mos is not a single app: the pure `core` is consumed by the web app and, later,
an MCP server and a VS Code extension, and there are non-Angular Node deliverables (the dev
filesystem server, the MCP server). A shared internal package consumed by multiple apps is
the textbook case for a workspace. Angular's own multi-project workspace handles Angular
apps and TS libraries but is an awkward umbrella for the Node services.

**Decision.** Use a **Bun-workspaces monorepo orchestrated by Turbo** from the start.
Layout: `apps/*` (web, dev-server, later desktop/mcp/vscode) and `packages/*` (core now;
others extracted only when genuinely shared). Turbo runs build/lint/test/dev with
dependency-aware ordering and caching. The Angular app is just `apps/web`.

We choose Turbo over **Nx** deliberately: Nx replaces `angular.json` with its own
`project.json` and wraps the CLI in executors/generators — it "hijacks" the project and is
harder to back out of. Turbo is a thin task-runner over the workspace that leaves the
Angular CLI and standard tooling untouched, which matches this project's preference for
tools that stay out of the way.

**Consequences.** No later refactor to extract `core`; one consistent place for every
deliverable; fast incremental builds via Turbo's cache. The cost is more setup in the
scaffold task (T-001) and the few known gotchas of running the Angular CLI as a workspace
package. Packages are created as needed, not pre-created empty, to avoid ceremony.

## ADR-009 — Icons: Tabler; fonts: self-hosted Inter + JetBrains Mono via Fontsource

**Status:** Accepted · **Date:** 2026-06-08

**Context.** As the wiki and board lenses (F-003, F-004) take shape they need a consistent
icon set and deliberate typography rather than ad-hoc glyphs and the system font stack. mos
is a local-first developer tool: it must read well at small sizes and in dense layouts, and
it shouldn't depend on a third-party font CDN at runtime (offline use, no FOUT, privacy). We
also don't want to mix icon libraries.

**Decision.** Use **Tabler icons** as the single icon set — a large, consistent, MIT-licensed
SVG set that fits a clean developer-tool aesthetic. Use **Fontsource** to self-host two
typefaces wired into the Tailwind v4 + daisyUI theme: **Inter** for UI text and **JetBrains
Mono** for code, card ids, and other monospace contexts. Fonts are registered in
`apps/web/src/styles.css` and exposed as `--font-sans` / `--font-mono` theme tokens (so
`font-sans` / `font-mono` utilities resolve to them); only the weights actually used are
bundled. Setup lives in T-006. Per-user font switching is explicitly a *later* option, not
part of this decision — the tokenized setup makes it cheap to add when wanted.

**Consequences.** One coherent visual foundation, fully self-hosted (works offline, no
runtime CDN, no layout shift), with code and ids highly legible. Components reference theme
tokens, not hardcoded font families, so swapping or adding a user-selectable font later is a
token change, not a refactor. The cost is a small bundle for the bundled weights and the
discipline of sticking to one icon set. If a future need arises (e.g. a user font picker or a
heavier icon requirement), supersede this ADR rather than mixing sets ad hoc.
