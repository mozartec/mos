---
created: 2026-06-07T13:00:00Z
updated: 2026-06-10T21:55:00Z
---

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
frontmatter writes. Edits touch frontmatter only, with **one narrow exception**: when an agent
ships a card, it may tick that card's own `## Acceptance` checkboxes (`- [ ]` → `- [x]`) to
record completion. No other prose is rewritten, and the app itself still never writes anything.

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

## ADR-010 — Creation/update timestamps live in frontmatter; fields are typed

**Status:** Accepted · **Date:** 2026-06-08

**Context.** We want to know when a card or doc was created and last changed. The obvious
source is git, but git is the wrong place: history is rewritten (the project squash-merges
PRs — see [`11-RELEASING.md`](11-RELEASING.md) — and rebases happen), and a core principle is
that a vault is just a folder of markdown that must be readable and portable *without* git at
all (ADR-001). A timestamp that disappears when history is rewritten, or when someone copies
the files out of the repo, isn't trustworthy. Separately, frontmatter values have until now
been untyped strings, so mos can't tell a date from a label well enough to render or sort it.

**Decision.** Record time in the files themselves. Add two optional frontmatter fields,
**`created`** and **`updated`** (ISO 8601 `datetime`), to cards and, optionally, wiki docs.
The names default to `created`/`updated` but are configurable per vault via
`meta.timestamps`. To support this honestly, introduce an optional **field-types registry**
(`fields` in config): each frontmatter field may declare a type (`string`, `enum`, `id`,
`date`, `datetime`), defaulting to `string` when unlisted. The app **reads** timestamps —
displays them (relative + absolute) and may sort by them — but **never writes** them; they
are maintained by the agent layer per `AGENTS.md` (set both on create; bump `updated` on any
frontmatter edit), consistent with ADR-002. Everything here is additive and optional, so the
spec moves to `0.2` without breaking any `0.1` vault, and a missing timestamp (common on
docs) is never an error — it's just not shown.

**Consequences.** Timestamps survive history rewrites and travel with the files, and the
typed-field registry pays off beyond dates (enums render as badges, ids resolve as links,
dates sort correctly). The cost is discipline in the write path: agents must maintain the
timestamps, since the read-only app won't, and an un-maintained vault will have stale
`updated` values — an acceptable trade for not putting write logic in the app. Field-type
validation is best-effort and non-fatal, so bad data degrades gracefully rather than
crashing a render. If automatic maintenance becomes important, the later MCP write server
(F-009) is the natural place to enforce it.

## ADR-011 — Three lenses: wiki, board, and dependency graph

**Status:** Accepted · **Date:** 2026-06-10

**Context.** ADR-004 established two independent, read-only lenses over the same vault — the
wiki (files as documents) and the board (cards as workflow state). Both look at one card at a
time. What neither shows is the *structure between* cards: which work blocks which, where the
critical path runs, and what could start in parallel right now. With `dependsOn` now a typed,
machine-readable field (F-012-S-01) and a pure layered layout in core (F-012-S-02), that
structure is data the app already has, with no view that renders it.

**Decision.** Add a third lens: the **dependency graph** (`GraphView`, routed like wiki and
board). It follows exactly the rules the first two lenses set. It is read-only (ADR-002) — it
renders and navigates, never edits an edge or a status. It is a thin projection (ADR-001) —
ranks, ordering, cycle handling, and (later) critical-path/ready-set math live in
`packages/core`; the component only positions and paints what core computed. It is
config-driven (ADR-003) — the relation comes from the field registry, node colors derive from
each type's state→column mapping, and nothing about this vault's type names is hardcoded. And
it reuses the shared reader (ADR-004) — clicking a node opens the card the same way a board
card opens, with a way back. Lenses stay independent: removing the graph lens (like removing
the board) breaks nothing else.

**Consequences.** "What should I kick off next, and what's in the way?" becomes answerable by
looking, for humans and (through the same core data) for future agents/MCP (F-009). The cost
is a third surface to keep consistent with the lens rules above; the mitigation is that each
new lens consumes core output rather than computing its own, so consistency is enforced by
the architecture. Adding further lenses (e.g. a timeline) should follow this same pattern and
supersede or extend this ADR.

## ADR-012 — The CLI: a published, Node-runnable package bundling the web app

**Status:** Accepted · **Date:** 2026-06-10

**Context.** Until now the only way to see a vault rendered was to clone this repo and run
the dev stack (ADR-006's dev server plus the Angular dev build) with `VAULT_DIR` pointed at
the folder. F-015 wants the validated web app usable in *any* project — another product repo, a
notes folder — with one command and no clone. That raises three choices: the runtime the
command runs on, how the UI and the file endpoints are served together, and how the
endpoint logic relates to the dev server we already trust.

**Decision.** Ship a CLI as an npm package, **`@mos/cli`**, exposing the **`mos`** bin
(`mos serve [dir] [--port]`). Three sub-decisions:

- **Authored in TypeScript, bundled for Node.** The source lives in `apps/cli` and is
  bundled at build time with `bun build --target=node`, so the published artifact is plain
  ESM JavaScript that runs on Node ≥ 20 — `npx`-able anywhere, no Bun required at runtime
  (Bun remains a build-time tool, which the repo already requires). `chokidar` is the only
  runtime dependency; workspace code is bundled in.
- **One process, one origin.** The build copies the production web build into the package
  (`dist/web`), and the server serves the SPA (with fallback for deep links) *and* the
  `/vault/*` endpoints on the same origin — exactly the relative URLs `HttpVaultSource`
  already uses, so the web app is byte-for-byte the same as in development.
- **The endpoints are shared, not duplicated.** The list/read/watch endpoints and the
  debounced watcher moved from the dev server into **`packages/vault-server`**, a
  runtime-agnostic fetch-style handler (web `Request`/`Response`). The Bun dev server
  (ADR-006) and the Node CLI are now two thin hosts of the same handler, so the contract
  can't drift between dev and production. It is **not** part of `packages/core` — it does
  I/O, and core stays pure (ADR-001).

The workspace root already holds the npm name `mos` for the monorepo, so the package is
scoped; whether to also publish under an unscoped alias is decided at first release.
ADR-002 holds throughout: the server rejects non-GET requests and has no write endpoint.

**Consequences.** Any project gets the board and wiki with `npx @mos/cli serve` (or a
global install giving plain `mos serve`) — the desktop app (F-007) stops being the only
"real app" path, and F-016 gets a natural home for `mos init`. Publishing requires the
repo's Bun toolchain, and the package carries the web build inside it, so its size tracks
the app bundle. The dev server keeps its dev-only role (ADR-006) with less code of its own.

## ADR-013 — Scaffolding is not a runtime write

**Status:** Accepted · **Date:** 2026-06-10

**Context.** ADR-002 draws mos's brightest line: the app reads the vault and never writes
it — writes belong to the agent layer. F-016 adds `mos init`, a CLI command that *creates
files*. Without a recorded boundary, "the CLI may write during init" erodes into "the CLI
may write", and the read-only guarantee dies by a thousand conveniences.

**Decision.** Scaffolding — creating a vault where none exists — is a **one-time bootstrap**
and is allowed in the CLI; operating on an existing vault is not. The boundary, precisely:

- `mos init` runs only where no `.mos/config.json` resolves; if one exists it **refuses
  and changes nothing** — no overwrite, no merge, no "update my config" mode.
- Even while scaffolding it never replaces an existing file (an existing `AGENTS.md` or
  card is skipped and reported, not merged).
- The serving path (`mos serve`, the dev server, the web app) keeps zero write endpoints,
  exactly as ADR-002 states.
- Anything that *mutates* an existing vault — moving cards, editing frontmatter, fixing
  timestamps — stays with the agent layer and the future MCP write server (F-009), never
  the CLI.

**Consequences.** Adoption gets a first mile (`mos init` → `mos serve`) without weakening
the read-only contract: after init completes, the CLI is as read-only as it ever was. The
cost is that config evolution stays manual (you edit JSON, guided by the agent stub and
the spec) — acceptable, because a config is small and owning it is the point. A future
"migrate my config" need would have to come back through a new ADR, not creep in here.

## ADR-014 — The CLI publishes as `@mozartec/mos-cli` on npmjs

**Status:** Accepted · **Date:** 2026-06-10

**Context.** ADR-012 shipped the CLI as workspace package `@mos/cli` and deferred the
published name to first release. On npmjs (checked 2026-06-10): `mos` and `mos-cli` are
taken as package names, and the `mos` scope is not available — so neither the obvious
unscoped name nor a `@mos/*` scope can be published. GitHub Packages was considered as an
alternative registry.

**Decision.** Publish to **npmjs** as **`@mozartec/mos-cli`** — `mozartec` is the scope the
project owns. The **bin stays `mos`**, so every documented invocation (`mos serve`,
`mos init`) is unchanged; only `npx`/install commands name the package
(`npx @mozartec/mos-cli serve`). GitHub Packages was rejected because installing from it
requires authentication even for public packages and forces owner-matched scopes — both
friction for the "render a vault with one command, no setup" goal. The workspace package is
renamed to match, so the published artifact and the repo agree on one name.

**Consequences.** Adoption is `npm i -g @mozartec/mos-cli` or `npx @mozartec/mos-cli` with
zero registry configuration. The name is less discoverable than a hypothetical unscoped
`mos`; if an unscoped alias ever becomes available, publishing one is a new decision. The
scope ties publishing rights to the `mozartec` npm account.
