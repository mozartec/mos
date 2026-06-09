---
id: F-006
type: feature
title: AI write convention (AGENTS.md)
status: Draft
dependsOn: []
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T23:20:00Z
phase: MVP
priority: P1
owner: mozart
sprint: S3
---

# F-006 — AI write convention (AGENTS.md)

Ship and refine the in-vault `AGENTS.md` so any assistant can create and update cards in
the correct shape. This is the supported "create a task" path for the MVP — no edit UI.

## Outcome

After this feature, every vault ships a self-contained `AGENTS.md` that lets any AI
assistant create and update cards correctly — right frontmatter, allowed types/states,
frontmatter-only edits (never rewriting prose), and a validation step. This is the MVP's
write path (ADR-002): there is no edit UI, so the convention *is* the product surface for
changing the board. The repo's own root `AGENTS.md` and the `examples/recipe-box/AGENTS.md`
are the reference implementations; this feature hardens and documents them.

## Context — read before starting

- [`AGENTS.md`](../AGENTS.md) §Managing this repo's backlog — the existing repo-level rules
  (frontmatter only, run `bun run validate`).
- [`examples/recipe-box/AGENTS.md`](../examples/recipe-box/AGENTS.md) — the standalone
  per-vault guide; the shape every vault should ship.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4–§5, §8 — the card frontmatter,
  allowed states per type, and "writes happen via the agent."
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — id rules, statuses, card readiness;
  the convention must point agents at these.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — ADR-002 (read-only app, agent writes),
  ADR-007 (cards target cold any-model agents).

## Constraints (must honor)

- **Frontmatter only, never rewrite prose** — the one rule the convention must enforce.
  (ADR-002, VAULT_SPEC §8)
- **Maintain timestamps** — the convention must tell agents to set `created`/`updated` on
  create and bump `updated` on every frontmatter edit, since the app never writes them
  (ADR-010, VAULT_SPEC §4a).
- Self-contained per vault — a cold agent succeeds from the vault's `AGENTS.md` plus the docs
  it links, no external memory. (ADR-007)
- Don't duplicate the spec — link to `docs/`; keep `AGENTS.md` a map. (CONVENTIONS)
- The convention's "did it work?" check is `bun run validate` (the interim validator until
  F-002's core parser graduates it).

## Plan

1. Audit the root and recipe-box `AGENTS.md` against VAULT_SPEC §4–§5: do they state allowed
   types/states, required frontmatter, the frontmatter-only rule, the timestamp-maintenance
   rule, and the validate step?
2. Fill gaps; add a short "create a card" and "update a card's status" worked example, each
   showing `created`/`updated` being set and `updated` being bumped.
3. Confirm a cold assistant can add a valid card from the guide alone, then `bun run
   validate` passes.

## Acceptance

- [ ] A vault's `AGENTS.md` lets an assistant create a valid new card and change a card's
      status, frontmatter-only.
- [ ] The guide names allowed types/states and the validation step; it links the spec rather
      than restating it.
- [ ] The guide instructs agents to set `created`/`updated` on create and bump `updated` on
      edit.
- [ ] `bun run validate` passes after agent-made changes.

## Dependencies

- **Depends on:** the existing `AGENTS.md` files (largely in place). Pairs with F-002 (the
  validator graduating into core).
- **Blocks:** —

## Out of scope

An MCP write server (F-009) and in-app editing (F-011) — both later. The prose/markdown
convention only.

## References

ADR-002, ADR-007; `docs/05-VAULT_SPEC.md` §4–§5, §8; `docs/09-CONVENTIONS.md`;
`AGENTS.md`; `examples/recipe-box/AGENTS.md`.
