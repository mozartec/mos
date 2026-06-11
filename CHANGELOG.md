# Changelog

All notable changes to this project are documented here.

From `0.1.0` on, entries are written by release-please from Conventional Commit titles
(ADR-015); don't edit this file by hand. The project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the version is `0.x`,
anything may change between releases — the format and app are not yet stable. See
[`docs/11-RELEASING.md`](docs/11-RELEASING.md) for how releases work.

> The **vault format** is versioned separately from the app. The current spec version is
> declared as `specVersion` in `.mos/config.json` and documented in
> [`docs/05-VAULT_SPEC.md`](docs/05-VAULT_SPEC.md).

## [0.2.0](https://github.com/mozartec/mos/compare/v0.1.0...v0.2.0) (2026-06-11)


### Features

* **release:** automate versioning, changelog, and npm publish ([#37](https://github.com/mozartec/mos/issues/37)) ([9cc1291](https://github.com/mozartec/mos/commit/9cc12910370a4a60e624664fa89ff99d60f76add))

## [0.1.0] — 2026-06-11

First published release: `@mozartec/mos-cli` on npm, bundling the web app.

### Added

- `@mozartec/mos-cli` — the published `mos` command: `mos serve [dir]` renders any vault's board
  and wiki without cloning this repo (F-015, ADR-012), backed by the shared
  `@mos/vault-server` endpoints.
- The web app the CLI serves: wiki, board, dependency-graph, and reader lenses over any
  mos vault — config-driven (types, states, and columns from `.mos/config.json`),
  live-reloading, strictly read-only. Internal links — id references and relative
  markdown paths — navigate in-app.
- `mos init [dir]` — scaffold a new vault (starter config, example card, agent guide);
  one-time bootstrap that never touches an existing vault (F-016, ADR-013).
- Optional `watch` config key: the vault-relative folders the server watches for live
  reload (default `["board", "docs"]`, plus the config file) — an allowlist instead of
  crawl-everything-with-ignores, so change events fire within seconds on big repos.
- Installable agent skills at `skills/` (`ship-card`, `next-card`) — vault-agnostic,
  config-driven, installable into any project with the skills CLI (F-014).
- Project documentation set (`docs/`): vision, concepts, architecture, tech stack, vault
  spec, MVP scope, roadmap, ADRs, conventions, glossary.
- Vault format **spec version 0.1** (`docs/05-VAULT_SPEC.md`), with the repository itself
  set up as a mos vault (`.mos/config.json`, `docs/` as wiki, `board/` as backlog).
- Live backlog under `board/` as cards (features, stories, tasks) following the spec.
- Generic example vault under `examples/recipe-box` to demonstrate the format is not tied
  to this project.
- `AGENTS.md` write convention for AI assistants.
- Front-door files: `README`, `LICENSE` (MIT), `CONTRIBUTING`.

[0.1.0]: https://github.com/mozartec/mos/releases/tag/v0.1.0
