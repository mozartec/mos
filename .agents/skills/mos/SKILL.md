---
name: mos
description: >
  Skills for working inside a mos vault — a folder of markdown where `board/*.md` files are
  cards and `.mos/config.json` defines the types, states, columns, and sprints. Use this
  family whenever you're managing or acting on a mos board: deciding what to do next, creating
  or updating cards, or otherwise operating the backlog. Trigger it in any repo that contains
  a `.mos/config.json`, even if the user doesn't say "mos". This file routes to the specific
  skill; read the matching sub-skill below.
metadata:
  version: 0.1.0
---

# mos vault skills

mos is a local-first tool that renders a folder of markdown as a wiki and a Kanban board. The
folder is the source of truth, the app is read-only, and cards are created/updated by agents
following the vault's `AGENTS.md`. These skills teach an agent to operate such a vault without
rediscovering the system each session.

This is a **router**. Find the task below and read that sub-skill.

| If the user wants to… | Read |
|---|---|
| Know what to work on next / start the next task, story, or card | [`./next-task/SKILL.md`](./next-task/SKILL.md) |

## Conventions for adding skills here

More mos skills will live as sibling folders under `.agents/skills/mos/` (e.g. a future
`new-card/` for scaffolding cards to the readiness standard, or `board-status/` for a board
summary). Follow the established pattern: one folder per skill, each with its own `SKILL.md`
whose `name:` is prefixed with `mos-` (e.g. `mos-next-task`), bundled scripts under the skill's
own `scripts/`, and a new row added to the table above. Keep each skill config-driven — read
types, states, columns, and sprints from `.mos/config.json` so the skill works on any mos
vault, not just this repo.
