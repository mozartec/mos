---
created: 2026-06-07T13:00:00Z
updated: 2026-06-13T15:27:00Z
---

# Core concepts

A small vocabulary runs through the whole project. Get these terms and the rest of
the docs read easily.

## Vault

A folder that mos opens. It contains a `.mos/config.json` and some markdown. That's it —
a vault is just a directory following the format in [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md).
This repository is a vault.

## Lens

A way of looking at the vault. mos has two, and they're independent:

- **Wiki lens** — renders any markdown file and makes its links clickable. It doesn't
  care about types, states, or the board. Its job is reading and navigation.
- **Board lens** — finds the *cards* in the vault and lays them out in columns by status.

Both lenses are read-only. Clicking a card in the board opens its file in the wiki lens —
they share one renderer.

## Card

A single markdown file that represents a unit of work — a feature, a story, a task. A
file is a card when it lives in the board folder **and** declares a recognized `type` in
its frontmatter. A file's identity is its `id`, not its path, so files can be renamed
freely.

## Type

The behavior of a card, declared in config. A type says which **states** a card may be
in (and which board column each maps to), whether it may have a **parent** (one nesting
level only, for now), and which fields to show on the card. mos hardcodes no types —
`feature`, `story`, and `task` are just the defaults this repo happens to use. Another
project could define `epic`, `bug`, and `chore` instead.

## Scope

An optional grouping the vault can put on the board — named by the vault, not by mos. A
config-designated field (a team might call it `sprint`, `cycle`, or `iteration`) scopes
the board to one group at a time, and its values may carry dates. A card with an empty
scope value is backlog. Vaults that pace work by parallel capacity instead of time-boxes
simply don't define one
([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)).

## Area

A named set of paths declared in config (e.g. `"web"` → `apps/web/**`), sized so that two
cards sharing an area really might conflict — by merge risk, not by app or layer (§5c). A
card lists the areas it expects to change in its `touches` field, which is what lets
planning pick **parallel batches** — ready cards that won't collide in the same files
([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)).
