---
name: next-card
description: >
  Recommend the next card to work on from a mos vault's board. Use when the user asks
  what to do next, what's ready, or to "grab the next task/story/card" in any repo
  with a `.mos/config.json`; requires that file and refuses to start without it. It
  recommends one card with a short rationale plus alternatives — shipping the pick is
  ship-card's job. Once a specific card is named, use ship-card instead.
metadata:
  version: 0.3.0
---

# next-card

Recommend the single best next card from the board. This skill only suggests —
building the confirmed pick is ship-card's job.

**Gate first:** this skill only runs inside a mos vault. If there is no `.mos/config.json`
at or above the working directory, tell the user this isn't a mos vault and stop. All
vocabulary — card types, states, columns, sprints — comes from that config. Never assume
id prefixes, type names, state names, or column names.

## 1. Run the ranking script

It lives in this skill's own `scripts/` folder — resolve the path from wherever the skill
is installed:

```bash
python3 <skill-dir>/scripts/next_card.py [<vaultDir>] [--sprint <s>] [--json]
```

It discovers the nearest vault, parses every card, resolves `Depends on:` ids, and prints
a ranked recommendation plus the blocked list. If Python isn't available, apply the model
below by reading the config and cards yourself.

## 2. The model (so you can sanity-check the script)

- Columns are progress, left→right; the last column means done. A status mapping to no
  column is hidden — never a candidate.
- **Ready** = not done, not hidden, not in a blocked status, and every `Depends on:` id
  sits in the last column.
- **Prefer leaves.** A card with children (`parent:` points at it) is a container; the
  script recommends its ready children. Shipping a whole container is a deliberate user
  choice — that's ship-card invoked with the container's id, not a pick this skill makes.
- **Rank ready cards:** started work first (already in a middle column), then priority
  order from the config's priority field, then sprint order from the config, then id.
- A pick whose body lacks `## Acceptance` isn't safe to hand off — flag it and offer to
  enrich the card first instead of charging ahead.

Read the nearest `AGENTS.md` too; it holds the vault's working rules.

## 3. Recommend

Present, briefly: the pick (id, title, one-line why), a shortlist of the next 2–3 ready
cards, and any caveat (everything blocked → name what unblocks it; thin card body → say
so). If the ask points at a container or a big card, steer toward a ready child first —
but a user who wants the bigger scope can have it. The user confirms or redirects in a
word.

## 4. Hand off on confirmation

Hand the confirmed id to the ship-card skill — shipping is its job, not this skill's.
If ship-card isn't installed, say so and stop at the recommendation.
