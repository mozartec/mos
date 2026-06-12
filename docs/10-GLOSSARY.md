---
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# Glossary

- **Vault** — a folder mos opens, following [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md). This
  repo is one.
- **Lens** — a view over a vault. mos has two: wiki and board.
- **Wiki lens** — the file viewer with link navigation.
- **Board lens** — the Kanban view of cards.
- **Card** — a file under the board folder with a recognized `type` in frontmatter.
- **Type** — config-defined behavior of a card: its states, parent rule, and shown fields.
- **State / status** — where a card is in its lifecycle; maps to a board column (or to
  `null` = hidden).
- **Column** — a board lane (e.g. Backlog, Planned, In Progress, Done).
- **Scope** — an optional, vault-named board grouping (a team's `sprint`, `cycle`, or
  `iteration`); an empty scope value = backlog
  ([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)).
- **Area** — a config-named set of paths a card can declare in its `touches` field
  ([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)).
- **Parallel batch** — ready cards whose declared areas don't overlap; safe to work
  concurrently
  ([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)).
- **Parent** — the feature a story belongs to; one nesting level only.
- **VaultSource** — the I/O adapter the app uses to read and watch files, independent of
  the pure core.
- **AGENTS.md** — the in-vault convention telling an AI assistant how to create/update
  cards.
