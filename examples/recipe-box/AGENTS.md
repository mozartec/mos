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

Example:

```markdown
---
id: RB-006
type: feature
title: Share a recipe by link
status: Idea
priority: P2
owner: chef
---

# RB-006 — Share a recipe by link

One paragraph describing the work.
```

## Updating a card

- **Only edit the frontmatter block. Never rewrite the prose body.**
- Move a card on the board by changing `status`.
- Parse the frontmatter, change the field, write it back — never blind find-and-replace.

## Do not

- Do not invent `type` or `status` values not in `.mos/config.json`.
- Do not create cards outside `board/`.
- Do not edit files in `docs/` as if they were cards.
