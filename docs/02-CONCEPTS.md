# Core concepts

A small vocabulary runs through the whole project. Get these five terms and the rest of
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

## Sprint

A short code (e.g. `S1`) on a card that groups it into a planning period. The board can
filter by sprint. A card with no sprint is backlog. Sprints are deliberately simple;
date-based scheduling is a future idea, not part of the model today.
