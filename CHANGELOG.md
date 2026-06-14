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

## [0.3.0](https://github.com/mozartec/mos/compare/v0.2.1...v0.3.0) (2026-06-14)


### Features

* **board:** collision badges & safe-to-start overlays (F-026) ([#58](https://github.com/mozartec/mos/issues/58)) ([644cfc3](https://github.com/mozartec/mos/commit/644cfc37126729d0c8ce4d377f627272b9325175))
* **board:** scoped board, backlog & config-driven filters (F-023) ([#56](https://github.com/mozartec/mos/issues/56)) ([a3f9804](https://github.com/mozartec/mos/commit/a3f980459f8bc042b4f1a044a2cacfd150c75e04))
* **core:** areas & touches — declared file surfaces (F-024) ([#49](https://github.com/mozartec/mos/issues/49)) ([0f37e34](https://github.com/mozartec/mos/commit/0f37e342a1c3224c3a7d3e0437b1ebf0d953d15a))
* **skills:** parallel-aware next-card & ship-card — batch picks and overlap pre-flight (F-025) ([#55](https://github.com/mozartec/mos/issues/55)) ([144d971](https://github.com/mozartec/mos/commit/144d971392496e12e9f8ba0a773c1944bc040248))
* **skills:** refine-batch skill — shape the backlog for parallel work (F-027) ([#60](https://github.com/mozartec/mos/issues/60)) ([1a85413](https://github.com/mozartec/mos/commit/1a854136f3299d68a12b05a1b60742bd486ad73e))
* **skills:** revise skills to 0.3.0 and refresh the installed copies ([#42](https://github.com/mozartec/mos/issues/42)) ([44673b4](https://github.com/mozartec/mos/commit/44673b4b8ebd9aca80277b299b936ce070facaed))
* **skills:** ship-card 0.4.0 — self-review before finishing (T-011, conventions) ([#50](https://github.com/mozartec/mos/issues/50)) ([d50c67b](https://github.com/mozartec/mos/commit/d50c67b9801755defdc3bc453b63e8b4e56447a5))
* **web:** adopt the Ink & Highlight design system (F-018) ([#46](https://github.com/mozartec/mos/issues/46)) ([8247e92](https://github.com/mozartec/mos/commit/8247e92e76e3862d5db8ed6df0248537e6d772f8))


### Bug Fixes

* **cli:** vault init stamps the current spec version (0.4) ([#51](https://github.com/mozartec/mos/issues/51)) ([d0d09a8](https://github.com/mozartec/mos/commit/d0d09a8081fcf3933f8bade3f48b5d372ef152d2))

## [0.2.1](https://github.com/mozartec/mos/compare/v0.2.0...v0.2.1) (2026-06-11)


### Bug Fixes

* **cli:** add repository metadata required by npm provenance ([#39](https://github.com/mozartec/mos/issues/39)) ([f36d1c1](https://github.com/mozartec/mos/commit/f36d1c14ae4dbcd5335e1cd7ae9edfe6c495999c))

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
