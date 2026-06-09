---
id: F-013
type: feature
title: Frontmatter field order
status: Draft
dependsOn: [T-001]
created: 2026-06-09T20:18:00Z
updated: 2026-06-09T23:20:00Z
phase: Phase 2
priority: P2
owner: mozart
---

# F-013 — Frontmatter field order

An optional config key that defines the canonical order of frontmatter properties. When
absent, a sensible default ships with mos.

## Outcome

After this feature, `.mos/config.json` can carry an optional `fieldOrder` (or similar) list
that defines the canonical order of frontmatter properties. Agents and scripts that create or
update cards emit properties in this order. The app reads frontmatter as a map, so order
doesn't affect rendering — this is a write-path concern that keeps cards consistent and
human-readable.

When `fieldOrder` is absent, a shipped default applies:

```
id, type, title, status, priority, phase, owner, sprint, parent, estimate, dependsOn, created, updated
```

Properties not in the list go after the listed ones, in the order they appear.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4 — the card frontmatter fields; the
  order they're documented in is a natural default.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — card template conventions; this
  feature makes the implicit order explicit and enforceable.
- [`.mos/config.json`](../.mos/config.json) — where the config key lives.
- [`AGENTS.md`](../AGENTS.md) — agents should respect the order when creating/updating cards.

## Constraints (must honor)

- **Optional and additive.** A vault without `fieldOrder` is valid; the default applies.
  (ADR-003)
- **Write-path only.** The app's read path (frontmatter → map) is unaffected by order.
  This is for agents, scripts, and validation.
- **Pure core.** The ordering utility lives in `packages/core`; no framework. (ADR-001)

## Plan

1. Add an optional `fieldOrder: string[]` to the config schema and `VaultConfig` type.
2. In core, add a utility `orderFrontmatter(data: Record<string, unknown>, order: string[]):
   Record<string, unknown>` that returns a new object with keys in the specified order.
3. Update `AGENTS.md` and the vault `AGENTS.md` to instruct agents to emit frontmatter in
   the configured order.
4. Optionally, add a `validate-vault.mjs` check that warns (not errors) when frontmatter
   keys are out of order.

## Acceptance

- [ ] `fieldOrder` is an optional config key with a documented default.
- [ ] A core utility reorders a frontmatter map by the configured order.
- [ ] Agent conventions reference the order.
- [ ] `bun run validate` warns on out-of-order frontmatter (non-fatal).

## Dependencies

- **Depends on:** T-001. **Blocks:** —

## Out of scope

Auto-reformatting existing cards (a one-off script can do that). The config key + utility +
conventions only.

## References

ADR-001, ADR-003; `docs/05-VAULT_SPEC.md` §4; `docs/09-CONVENTIONS.md`.
