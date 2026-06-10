---
id: F-016
type: feature
title: Vault scaffolding (mos init)
status: Planned
priority: P2
phase: Phase 2
owner: mozart
dependsOn: [F-015]
created: 2026-06-10T10:33:00Z
updated: 2026-06-10T10:33:00Z
---

# F-016 — Vault scaffolding (`mos init`)

Adopting mos in an existing project (a new ERP repo, say) currently means hand-writing
`.mos/config.json` by copying this repo's. This feature gives the CLI an `init` command
that turns any folder into a valid vault in one step, with the project's own card types —
the missing first mile before F-015's `serve` and the F-014 skills are usable elsewhere.

## Outcome

```bash
npx mos init [dir]
```

scaffolds a working vault: a `.mos/config.json` from a starter template (types, states,
columns, sprints — sensible defaults the user then edits), a `board/` folder with one
example card demonstrating the frontmatter and readiness sections, and an agent-guide
stub (`AGENTS.md` section or file, modeled on `examples/recipe-box`) carrying the write
rules. `init` never overwrites an existing config — it reports and stops.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — what a valid config and card look
  like; the template must satisfy it.
- [`examples/recipe-box/`](../examples/recipe-box/) — the reference standalone vault,
  including its `AGENTS.md`; `init` output should resemble it.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — readiness sections the example
  card should demonstrate.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002; see Constraints on why
  `init` doesn't break it.

## Constraints (must honor)

- **Scaffolding is not the app writing.** ADR-002 keeps the *app* read-only over an
  existing vault; `init` is a one-time bootstrap that creates a vault where none exists.
  Record this boundary as an ADR so it never creeps into runtime write features.
- **Config-driven** (ADR-003) — the template is a starting point the user owns; nothing
  in the app assumes the template's specific types.
- **Never destructive** — existing `.mos/`, `board/`, or agent guides are left untouched;
  `init` refuses rather than merges.

## Plan

Feature-level; stories to be cut when this is picked up. The expected shape:

1. A starter config template (validated against the spec) + one example card + agent-guide
   stub, derived from `examples/recipe-box`.
2. `mos init [dir]` in the F-015 CLI: writes the template, refuses on conflict.
3. An ADR recording the scaffolding-vs-runtime-writes boundary.
4. Docs: the "use mos in your project" page starts with `init`.

## Acceptance

- [ ] In an empty folder, `init` then `serve` renders a working board with the example
      card, and `validate` (or the equivalent check) passes on the scaffolded vault.
- [ ] The scaffolded config conforms to `docs/05-VAULT_SPEC.md` and is plainly editable
      (commented template or documented fields) to the project's own types.
- [ ] Running `init` where a `.mos/config.json` already exists changes nothing and says so.
- [ ] The scaffolding-vs-ADR-002 boundary is recorded as an ADR.

## Dependencies

- **Depends on:** F-015 (lives in the same CLI). **Blocks:** —

## Out of scope

Interactive wizards/prompts beyond flag defaults, migrating existing issue trackers into
cards, and any runtime write capability in the app (F-011 covers that separately).

## References

ADR-002, ADR-003; `docs/05-VAULT_SPEC.md`, `docs/09-CONVENTIONS.md`,
`examples/recipe-box/`.
