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

## [0.6.0](https://github.com/mozartec/mos/compare/v0.5.0...v0.6.0) (2026-07-05)


### Features

* **core:** pure search index, query, snippet offsets, and scope helper (F-036-S-01) ([#94](https://github.com/mozartec/mos/issues/94)) ([73cd4cd](https://github.com/mozartec/mos/commit/73cd4cd468fc64f9094edb647e825d348094634a))
* **web:** highlight and scroll to search matches in the reader (F-036-S-03) ([#99](https://github.com/mozartec/mos/issues/99)) ([c85e0ed](https://github.com/mozartec/mos/commit/c85e0ed1f67f6436c2a471d90c7da16fd7b89371))
* **web:** live watch re-index for vault search (F-036-S-04) ([#101](https://github.com/mozartec/mos/issues/101)) ([005b29d](https://github.com/mozartec/mos/commit/005b29ddf7f619421af204d44804185f99faa787))
* **web:** pin the top bar and give the wiki tree its own scroll (F-035-S-01) ([#92](https://github.com/mozartec/mos/issues/92)) ([de4809a](https://github.com/mozartec/mos/commit/de4809a31fe6aacc477fd89f0cd8c7c272839ce1))
* **web:** render Mermaid diagrams in the reader (F-035-S-03) ([#96](https://github.com/mozartec/mos/issues/96)) ([25ac733](https://github.com/mozartec/mos/commit/25ac733360e43a14908416b7ce98bbdd45bb45ec))
* **web:** search the vault from the wiki lens (F-036-S-02) ([#97](https://github.com/mozartec/mos/issues/97)) ([10e50a5](https://github.com/mozartec/mos/commit/10e50a50867958eaebb88e351adeaadd1b8c6dee))
* **web:** widen the reader so code and tables are readable (F-035-S-02) ([#95](https://github.com/mozartec/mos/issues/95)) ([4262b0c](https://github.com/mozartec/mos/commit/4262b0c9eee6504ca08f48def76184b9449ba240))

## [0.5.0](https://github.com/mozartec/mos/compare/v0.4.0...v0.5.0) (2026-07-02)


### Features

* **board:** group-by-parent swimlanes, full-width layout, and the T-030 Type-facet fix (F-034) ([#89](https://github.com/mozartec/mos/issues/89)) ([59387bd](https://github.com/mozartec/mos/commit/59387bdc9c89a79389398485e0068f10a2c1ea8f))

## [0.4.0](https://github.com/mozartec/mos/compare/v0.3.1...v0.4.0) (2026-07-02)


### Features

* **board:** Document task T-028 for Windows script compatibility ([#79](https://github.com/mozartec/mos/issues/79)) ([75973cf](https://github.com/mozartec/mos/commit/75973cf74da23c6fb83396d506fc0af1ee552dd4))
* **core:** add childrenOf, dependentsOf & children-progress lookups (F-021-S-01) ([#82](https://github.com/mozartec/mos/issues/82)) ([afdbd86](https://github.com/mozartec/mos/commit/afdbd86bf69b83a6764416612de3a3905eaa85fc))
* session 2 — structured diagnostics, shared report renderer, docs consolidation, refine-batch mechanics (T-021, T-022, T-025, T-027) ([#88](https://github.com/mozartec/mos/issues/88)) ([8ee9bd3](https://github.com/mozartec/mos/commit/8ee9bd38d8f276edcfb33f2cd3abf5ef7772a607))
* **skills:** config-declared card readiness for refine-batch (F-033) ([#85](https://github.com/mozartec/mos/issues/85)) ([fb32242](https://github.com/mozartec/mos/commit/fb32242ba0e03c20ed64b41bb882ff27fdcba53a))
* **web:** card page, detail component & reader redirect (F-021-S-02) ([#83](https://github.com/mozartec/mos/issues/83)) ([6616bf3](https://github.com/mozartec/mos/commit/6616bf381dfacc340bdd8bba1de2da86a65651ef))
* **web:** subcards on the board, cards lens & F-021 close-out (F-022, F-020, F-021) ([#87](https://github.com/mozartec/mos/issues/87)) ([e01c513](https://github.com/mozartec/mos/commit/e01c5134eb784a9ff79b74a761832073aed17d24))
* **web:** URL-driven side peek over the board (F-021-S-03) ([#86](https://github.com/mozartec/mos/issues/86)) ([13a2e42](https://github.com/mozartec/mos/commit/13a2e426928ac5b042d6cb84a9c76bfa216df1ed))


### Bug Fixes

* **skills:** make bundled scripts run clean on a Windows cp1252 console ([#81](https://github.com/mozartec/mos/issues/81)) ([95f8e58](https://github.com/mozartec/mos/commit/95f8e58712b1516058c6b3cec955bbd3118633a8))

## [0.3.1](https://github.com/mozartec/mos/compare/v0.3.0...v0.3.1) (2026-06-21)


### Bug Fixes

* **cli:** vault discovery skips hidden dirs so .claude/worktrees aren't phantom vaults ([#75](https://github.com/mozartec/mos/issues/75)) ([34331c9](https://github.com/mozartec/mos/commit/34331c9bbbb7e634147f4542e4983ca316beec74))

## [0.3.0](https://github.com/mozartec/mos/compare/v0.2.1...v0.3.0) (2026-06-20)


### Features

* **board:** collision badges & safe-to-start overlays (F-026) ([#58](https://github.com/mozartec/mos/issues/58)) ([644cfc3](https://github.com/mozartec/mos/commit/644cfc37126729d0c8ce4d377f627272b9325175))
* **board:** scoped board, backlog & config-driven filters (F-023) ([#56](https://github.com/mozartec/mos/issues/56)) ([a3f9804](https://github.com/mozartec/mos/commit/a3f980459f8bc042b4f1a044a2cacfd150c75e04))
* **cli:** add `mos validate` command (F-029) ([#67](https://github.com/mozartec/mos/issues/67)) ([8529978](https://github.com/mozartec/mos/commit/85299783cba33ee6e32e8b5fd1198e9430429f40))
* **cli:** scaffold portable framework guide at .mos/AGENTS.md (F-030) ([#71](https://github.com/mozartec/mos/issues/71)) ([1e70b40](https://github.com/mozartec/mos/commit/1e70b40e6fc578171e5277db7d013137b710863c))
* **core:** areas & touches — declared file surfaces (F-024) ([#49](https://github.com/mozartec/mos/issues/49)) ([0f37e34](https://github.com/mozartec/mos/commit/0f37e342a1c3224c3a7d3e0437b1ebf0d953d15a))
* **scripts:** validator flags overlapping area globs (T-012) ([#61](https://github.com/mozartec/mos/issues/61)) ([0a830c2](https://github.com/mozartec/mos/commit/0a830c2639057fbf387886629e323cd1dd64f809))
* **skills:** parallel-aware next-card & ship-card — batch picks and overlap pre-flight (F-025) ([#55](https://github.com/mozartec/mos/issues/55)) ([144d971](https://github.com/mozartec/mos/commit/144d971392496e12e9f8ba0a773c1944bc040248))
* **skills:** prefix first-party skills with the mos- namespace (T-013) ([#62](https://github.com/mozartec/mos/issues/62)) ([e9d2e46](https://github.com/mozartec/mos/commit/e9d2e46b43cf6fa8d2bd8517ee145198ddb1edef))
* **skills:** refine-batch skill — shape the backlog for parallel work (F-027) ([#60](https://github.com/mozartec/mos/issues/60)) ([1a85413](https://github.com/mozartec/mos/commit/1a854136f3299d68a12b05a1b60742bd486ad73e))
* **skills:** revise skills to 0.3.0 and refresh the installed copies ([#42](https://github.com/mozartec/mos/issues/42)) ([44673b4](https://github.com/mozartec/mos/commit/44673b4b8ebd9aca80277b299b936ce070facaed))
* **skills:** ship-card 0.4.0 — self-review before finishing (T-011, conventions) ([#50](https://github.com/mozartec/mos/issues/50)) ([d50c67b](https://github.com/mozartec/mos/commit/d50c67b9801755defdc3bc453b63e8b4e56447a5))
* **web:** adopt the Ink & Highlight design system (F-018) ([#46](https://github.com/mozartec/mos/issues/46)) ([8247e92](https://github.com/mozartec/mos/commit/8247e92e76e3862d5db8ed6df0248537e6d772f8))


### Bug Fixes

* **cli:** vault init stamps the current spec version (0.4) ([#51](https://github.com/mozartec/mos/issues/51)) ([d0d09a8](https://github.com/mozartec/mos/commit/d0d09a8081fcf3933f8bade3f48b5d372ef152d2))
* **core:** sanitize non-object field defs in loadConfig (T-020) ([#69](https://github.com/mozartec/mos/issues/69)) ([cc6130f](https://github.com/mozartec/mos/commit/cc6130f692f4b1f461f63dcbb631b922841c6c76))
* **web:** drop the graph ready dot on in-flight cards (T-014) ([#68](https://github.com/mozartec/mos/issues/68)) ([424ec92](https://github.com/mozartec/mos/commit/424ec9287c398da1b61985cef826eda5ca6b6ef7))

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
