# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the
version is `0.x`, anything may change between releases — the format and app are not yet
stable. See [`docs/11-RELEASING.md`](docs/11-RELEASING.md) for how releases work.

> The **vault format** is versioned separately from the app. The current spec version is
> declared as `specVersion` in `.mos/config.json` and documented in
> [`docs/05-VAULT_SPEC.md`](docs/05-VAULT_SPEC.md).

## [Unreleased]

The project is in its planning stage. No app has been released yet; the first tagged
release will be `v0.1.0`.

### Added

- `@mos/cli` — the published `mos` command: `mos serve [dir]` renders any vault's board
  and wiki without cloning this repo (F-015, ADR-012), backed by the shared
  `@mos/vault-server` endpoints.
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

[Unreleased]: https://github.com/mozartec/mos/commits/main
