# AGENTS.md — managing the Recipe Box vault

You are an AI assistant helping manage this project's backlog. This vault is a folder of
markdown rendered by **mos** as a board. You create and update **cards** here; the mos app
only reads them. Follow these rules exactly — they're self-contained, you don't need any
other files.

## What a card is

A card is one markdown file under `board/` whose frontmatter declares a recognized `type`.
Files without a recognized `type`, and anything in `docs/`, are wiki pages, not cards.

## Creating a card

1. Put the file in `board/`, named `<id>-<slug>.md` (e.g. `board/RB-006-share-recipe.md`).
2. Add YAML frontmatter at the very top. Required: `id`, `type`, `title`, `status`.
3. `type` is one of (from `.mos/config.json`):
   - `feature` — states: `Idea` | `Building` | `Done` | `Parked`
   - `bug` — states: `Reported` | `Fixing` | `Fixed`
4. `status` must be one of that type's states.
5. `id` is unique and stable (this vault uses the `RB-NNN` prefix). Neither type has a
   parent here.
6. Optional fields shown on the card: `priority` (P0–P3), `owner`.
7. Set `created` and `updated` to the current time, ISO 8601 UTC (e.g.
   `2026-06-08T09:00:00Z`).
8. Write the frontmatter properties in this order (the mos default; a vault can override
   it with `fieldOrder` in `.mos/config.json`): `id`, `type`, `title`, `status`,
   `priority`, `owner`, `created`, `updated` — any other property goes after these.

Example:

```markdown
---
id: RB-006
type: feature
title: Share a recipe by link
status: Idea
priority: P2
owner: chef
created: 2026-06-08T09:00:00Z
updated: 2026-06-08T09:00:00Z
---

# RB-006 — Share a recipe by link

One paragraph describing the work.
```

## Updating a card

- **Only edit the frontmatter block. Never rewrite the prose body.**
- Move a card on the board by changing `status`.
- **Bump `updated`** to the current time on every frontmatter edit; leave `created` as-is.
  The app never writes these — keeping them current is your job.
- Parse the frontmatter, change the field, write it back — never blind find-and-replace.

Example — starting work on RB-006 (only `status` and `updated` change; everything else,
including the prose below the frontmatter, stays byte-for-byte identical):

```diff
 ---
 id: RB-006
 type: feature
 title: Share a recipe by link
-status: Idea
+status: Building
 priority: P2
 owner: chef
 created: 2026-06-08T09:00:00Z
-updated: 2026-06-08T09:00:00Z
+updated: 2026-06-09T14:30:00Z
 ---
```

## Check your work

After creating or editing cards, run the mos vault validator from the directory that
contains this vault and confirm it reports the vault as valid (every card maps to a
column, ids are unique, parents resolve, timestamps are well-formed):

```bash
node scripts/validate-vault.mjs examples/recipe-box   # from the mos repo root
```

(In a standalone vault, run the validator that ships with your mos install the same way.)
If it reports errors, fix the frontmatter until it passes — don't leave the board broken.

## Do not

- Do not invent `type` or `status` values not in `.mos/config.json`.
- Do not create cards outside `board/`.
- Do not edit files in `docs/` as if they were cards.
