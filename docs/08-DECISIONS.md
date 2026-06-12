---
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T19:10:00Z
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

## ADR-015 — Releases are automated: release-please + npm trusted publishing

**Status:** Accepted · **Date:** 2026-06-11

**Context.** `0.1.0` was versioned, changelogged, and published by hand (T-008). Manual
releases don't scale: versions drift from commit history, the changelog rots, and
publishing depends on one machine.

**Decision.** Releases run from GitHub Actions (`release-please.yml`):

- **release-please** maintains a rolling release PR (version + changelog, computed from
  the squash-merged Conventional Commit titles; one version line for the repo, with
  `apps/cli/package.json` in lockstep). Merging that PR is the release: it tags
  `vX.Y.Z` and creates the GitHub Release. Pre-1.0, breaking changes bump the minor
  (`bump-minor-pre-major`).
- **Publishing runs in the same workflow**, gated on a release being created — tags
  pushed with the workflow's `GITHUB_TOKEN` cannot trigger other workflows. The publish
  job reruns the pack-and-install smoke test before `npm publish`; red smoke, no publish.
- **Auth is npm trusted publishing** (OIDC, provenance) — no npm token in repo secrets;
  a granular per-package automation token is the fallback if OIDC fails.

**Consequences.** A release is one merged PR; versions and the changelog are never edited
by hand. Only `feat`/`fix` (and breaking) commits feed a release PR — `docs`/`chore`/`ci`
merges alone release nothing.

## ADR-016 — Design system: "Ink & Highlight" over stock themes

**Status:** Accepted · **Date:** 2026-06-12

**Context.** The web app shipped on daisyUI's stock `wireframe`/`black` themes — both
all-grayscale, so the product has no brand color — with Inter as the typeface. The per-type
card colors use raw Tailwind classes with `dark:` variants, and Tailwind keys `dark:` on
the OS `prefers-color-scheme` while the app's toggle sets `data-theme`; when the two
disagree, card colors render for the wrong theme.

**Decision.** Adopt the **Ink & Highlight** design system, specified in
[`13-DESIGN_SYSTEM.md`](13-DESIGN_SYSTEM.md): two custom daisyUI themes (`mos-paper`
light, `mos-carbon` dark, warm-hued, amber highlighter accent), IBM Plex Sans/Mono with
Newsreader for rendered prose, and semantic daisyUI tokens as the only sanctioned color
source. The `dark:` variant is re-keyed to `data-theme` via `@custom-variant`, and the
curated card-color ramp (VAULT_SPEC §5b) stays the single permitted raw-palette use,
centralized in one mapping.

**Consequences.** Every view is restyled once against tokens (F-018); future UI work has
one place to look for color/type/motion rules. The stored theme names change, so the theme
service migrates the persisted value. The doc is normative: app and doc may not drift.

## ADR-017 — Sprints: names with optional dates

**Status:** Superseded by [ADR-020](#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint) · **Date:** 2026-06-12

**Context.** `config.sprints` is a flat ordered list of names. A board that shows one
sprint at a time needs to know which sprint is *current*, and plain names can't say.

**Decision.** A `sprints` entry is **either a string or an object**
`{ "name": "S2", "starts": "2026-06-15", "ends": "2026-06-28" }` (dates optional,
ISO 8601, UTC dates). With dates, the app resolves the current sprint by date and may show
time remaining; without, it falls back to the last sprint with unfinished cards, then the
user's last selection. Normalization and current-sprint resolution are pure core functions
(the clock is an input). This is an additive vault-spec change: **spec 0.3 → 0.4**;
existing string-only vaults parse unchanged.

**Consequences.** Vaults opt into dates per sprint, no migration. The validator learns the
object form and flags malformed or overlapping dates. Auto-generated cadences (true
Linear-style cycles) remain a possible future ADR; nothing here precludes them.

## ADR-018 — Board scope: one sprint at a time; Backlog = no sprint

**Status:** Amended by [ADR-020](#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint) · **Date:** 2026-06-12

**Context.** The board renders every card at once with a sprint `<select>`, and "Backlog"
ambiguously names both a board column (a status mapping) and the filter value for cards
without a sprint.

**Decision.** The board lens is **scoped to one sprint at a time** (switcher in the
header; vaults with no `sprints` configured keep today's unscoped board). **Backlog** is
defined as *cards whose sprint field is empty and whose status isn't done*, shown as its
own priority-ranked list view — independent of which column a status maps to. A vault's
"Backlog" *column* remains a plain status mapping and simply isn't what the Backlog view
means. Cross-sprint browsing belongs to the Cards lens (F-020), not the board.

**Consequences.** The board answers "how is this sprint going", the backlog answers "what
is unscheduled" — without double-counting. The sprint `<select>` retires in favor of the
scope switcher plus a config-driven filter bar shared with the Cards lens.

## ADR-019 — Subcards: children are the board's units

**Status:** Accepted · **Date:** 2026-06-12

**Context.** Hierarchy exists in the data (`parent:` on stories), but the board renders
parents and children as undifferentiated cards in columns; container progress is
invisible, and a container card in a column says nothing about where its children stand.

**Decision.** Cards that other cards name as `parent` are **containers** and don't occupy
board columns; the board's units are **leaf cards**, each carrying a small parent
breadcrumb chip linking to its container. Containers surface in list views (Backlog,
Cards) with a children-progress chip (*n/m done*), and a card's page/peek shows its
children with statuses. This matches the agent-side "prefer leaves" rule the next-card
skill already applies.

**Consequences.** Board column counts mean shippable units. Containers never look stalled
in a column they don't really occupy; their progress is computed, not asserted. Vaults
without hierarchy see no change.

## ADR-020 — Board scope is a config-named grouping, not a built-in sprint

**Status:** Accepted · **Date:** 2026-06-12

**Context.** The spec hardcodes one pacing vocabulary: a top-level `sprints` list and a
`sprint` field. Trackers don't even agree on the word (Jira sprints, Linear cycles, Azure
iterations), and vaults that pace work by parallel capacity rather than time-boxes carry
a field they never set. A pacing concept the format imposes — instead of one the vault
declares — contradicts
[ADR-003](#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type).

**Decision.** Spec 0.4 replaces the built-in sprint with an optional, vault-named
**scope**: `board.scopeField` designates any enum field (a vault may call it `sprint`,
`cycle`, `iteration`, …) as the board's scope. That field's values are strings or dated
objects `{ "name", "starts"?, "ends"? }` —
[ADR-017](#adr-017--sprints-names-with-optional-dates)'s dated form, generalized; value
normalization and current-scope resolution stay pure core functions with the clock as an
input. No `scopeField` means no scope UI and an unscoped board. The backlog of
[ADR-018](#adr-018--board-scope-one-sprint-at-a-time-backlog--no-sprint) becomes
scope-relative: *cards with an empty scope value and a non-done status*, defined
only when a scope field exists. For compatibility, 0.4 readers treat a 0.3 `sprints` key
as a `sprint` scope field; new configs use `scopeField`. This vault defines no scope
field; a swap-in config that does is kept at
[`.mos/config.with-sprints.json`](../.mos/config.with-sprints.json).

Supersedes [ADR-017](#adr-017--sprints-names-with-optional-dates) (dated form survives
as dated scope values) and amends
[ADR-018](#adr-018--board-scope-one-sprint-at-a-time-backlog--no-sprint) (same
board/backlog semantics, expressed over the scope field).

**Consequences.** Naming follows the team, not the tool, and time-boxing becomes a choice
instead of a default. F-023 builds the scoped board and backlog on this model and ships
the spec text with the parser. Until it lands, 0.3 vaults behave exactly as today.

## ADR-021 — Cards declare a physical surface; parallel work is planned as conflict-free batches

**Status:** Accepted · **Date:** 2026-06-12

**Context.** `dependsOn` captures logical order, and the graph lens
([ADR-011](#adr-011--three-lenses-wiki-board-and-dependency-graph)) answers
"what is unblocked" — but two unblocked cards can still rewrite the same files. The
format says nothing about which files a card will change, so work declared parallel meets
again as merge conflicts, and the cost lands at integration time when planning could have
prevented it. In an AI-paced vault, parallel throughput is the capacity planning manages.

**Decision.** Spec 0.4 adds **areas**: a config map of vault-defined names to glob lists
(e.g. `"areas": { "web": ["apps/web/**"] }`), and a `touches` list field in which a card
names the areas it expects to modify. The writing agent fills `touches` at planning time
([ADR-002](#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)). A
**parallel batch** is a set of ready cards — dependencies done — whose
`touches` are pairwise disjoint; batch computation is a pure core function. The validator
flags a `touches` entry that names no configured area. Verifying declarations against
actual diffs (git-computed overlap) is deliberately future work, recorded here so the
declared model stays the floor it builds on.

**Consequences.** "Can these run in parallel?" gets a checkable answer instead of a
guess. F-024 ships the spec/core/validator pieces, F-025 teaches the skills to recommend
batches and pre-flight overlaps, F-026 surfaces collisions on the board. Until git
verification exists, a wrong declaration still slips through — declared truth bounds the
plan, not the diff.

## ADR-022 — Backlog refinement may reshape cards that haven't left their initial state

**Status:** Accepted · **Date:** 2026-06-12

**Context.** The write discipline of
[ADR-002](#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer) — frontmatter
only, never rewrite prose — protects decided cards from drift. But it also forbids the
one upstream activity conflict-aware planning depends on: reshaping not-yet-ready cards
so parallel-safe batches exist to be picked.
[ADR-021](#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
detects collisions at pick and ship time; it cannot fix a backlog whose cards all pile
onto one surface. Early-stage repos concentrate work in shared plumbing, and a backlog
decomposed feature-first yields "independent" cards that every one of them touches —
batch math then correctly answers "one at a time."

**Decision.** **Refinement** is a distinct, explicitly invoked agent-layer stage that
applies only to cards still in their type's *initial* state (this vault: `Draft` /
`Todo` — the first state each type declares in config). During refinement the agent may
rewrite card prose, split a card, create enabler cards, and set `touches` and
`dependsOn`. Splits follow the vault's hierarchy where the type allows a parent: an
oversized card becomes a container with child cards
([ADR-019](#adr-019--subcards-children-are-the-boards-units)) rather than a scatter of
siblings, so the split stays legible on the board. The goal is raising cards to the
cold-start standard
([ADR-007](#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents))
*and* reshaping overlap clusters into sequenced enablers plus disjoint leaves. Once a
card leaves its initial state, ADR-002 applies unchanged (the sole prose edit remains
ticking `## Acceptance` on ship). Refinement never happens as a side effect of picking
or shipping; it runs only when asked. The packaged form is the refine-batch skill
(F-027), and the conventions text updates ship with it.

**Consequences.** Backlog *shape* becomes an explicit work product: a refinement pass
turns "four parallel features that all collide" into "one enabler, then three safe
leaves." Decided cards keep their no-drift guarantee, and the boundary is mechanical — a
status check — so any agent can apply it cold. Until F-027 ships, the blanket no-prose
rule stays in force.
