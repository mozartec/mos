---
name: mos-next-task
description: >
  Pick — and then start — the next thing to work on from a mos vault's board. Use this
  whenever the user asks what to do next, to "tackle/start/pick up/grab the next task" (or
  story, card, ticket, or item), what's next on the board, what they should work on now, or
  "what's ready" — in any repo that has a `.mos/config.json`. Trigger it even when the user
  doesn't say the word "mos": if a board of markdown cards under `board/` is in play and they
  want a recommendation on what to do next, this is the skill. It reads the board the way the
  maintainer would, recommends one card with reasoning, then works it on confirmation.
metadata:
  version: 0.1.0
---

# mos — pick the next task

A **mos vault** is a folder of markdown where `board/*.md` files are cards, `.mos/config.json`
defines the card types/states/columns/sprints, and the app only reads — humans and agents
write the cards. Glancing at the rendered board, a maintainer instantly knows what to do
next. Your job is to reproduce that judgment from the files alone, recommend the single best
next card with a short rationale, and then — once the user confirms — actually do it.

Why this skill exists: without it, an agent asked to "do the next task" has to discover the
whole system from scratch every session (what's a card? what's blocked? what's a good pick?).
This skill encodes the model and the heuristics so a cold agent on any model gets it right
cheaply.

## Step 1 — run the ranking script

It does the mechanical part deterministically: discovers the vault, reads the config, parses
every card, resolves `Depends on:` links, and prints a ranked recommendation plus the blocked
list. Run it before reasoning, so you start from facts, not a guess:

The script is bundled in **this skill's own `scripts/` folder**, so use the copy that ships
with the skill — its location depends on where the skill is installed. In this repo that is
`.agents/skills/mos/next-task/scripts/next_task.py`; when the skill is installed into another
project via `npx skills add`, the parent path differs, so locate it rather than hardcoding:

```bash
# in this repo:
python3 .agents/skills/mos/next-task/scripts/next_task.py [<vault-dir>]
# anywhere (resilient to where the skill was installed; skips node_modules/.git):
python3 "$(find . -type d \( -name node_modules -o -name .git \) -prune -o \
  -path '*next-task/scripts/next_task.py' -print | head -1)" [<vault-dir>]
# options: --sprint S1   (only consider that sprint)   --json   (machine-readable)
```

With no path it finds the nearest `.mos/config.json` at or above the working directory, so it
works from anywhere in the repo and on **any** mos vault (e.g. `examples/recipe-box`), not
just this one. If Python isn't available, fall back to reading the config and cards yourself
using the model below — the script is an accelerator, not a dependency.

## Step 2 — understand the model (so you can sanity-check the script)

Everything is config-driven; never hardcode `F-`/`T-`, column names, or states — read them
from `.mos/config.json`. The ranking the script applies, and that you should agree with:

- **Columns are progress, left→right.** The last column (e.g. `Done`, `Shipped`) means done.
  A state mapping to `null` (e.g. `Deferred`, `Dropped`) is hidden — never a candidate.
- **A card is *ready* only if** it isn't done, isn't hidden, isn't `Blocked`, and every id on
  its `Depends on:` line sits in the last column. A card waiting on an unfinished dependency
  isn't actionable — the real next task may be that dependency.
- **Execute leaves, not umbrellas.** A feature that has child stories (`parent:` points at it)
  is a container; you work its next ready story or a task, not the feature card itself.
- **Ranking among ready cards:** finish started work first (cards already in a middle column),
  then by priority (`P0` > `P1` > …), then by sprint order from `config.sprints`, then by id.
  This mirrors limiting work-in-progress and respecting the current sprint.
- **Readiness of the card itself.** Per the vault's conventions, a card is only safe to hand a
  cold agent if its body carries the work (an `## Acceptance` section at minimum, usually also
  Outcome/Context/Constraints/Plan). The script flags a top pick that lacks `## Acceptance`.
  If the best pick isn't written to that bar, say so and offer to enrich it first rather than
  charging ahead on a thin card.

Read the nearest `AGENTS.md` too (root, and any closer one) — it holds the vault's working
rules and is the entry point a card assumes you've read.

## Step 3 — recommend

Present, concisely:

- **the pick** — id, title, and the one-line why (e.g. "highest-priority ready card in the
  active sprint; its only dependency, T-001, is Done");
- **a shortlist** of the next 2–3 ready cards, so the user can redirect with one word;
- **any caveat** — if everything ready is blocked, name what's blocking and the unblock path;
  if the pick's card body is thin, flag it.

Keep it short. The user can usually confirm or redirect in a word.

## Step 4 — execute on confirmation

This skill recommends, then does the work — but check in before diving in, because the user
often wants to redirect the pick. Once they confirm (or if they already said "just do the next
task and start"):

1. Open the card file and read it fully — it lists the docs/ADRs to read, the constraints to
   honor, the plan, and the acceptance checklist. Read what it points to.
2. Do the work the card scopes — only that. Honor the vault's non-negotiables from `AGENTS.md`.
3. When the card is also a vault card you're updating (status, etc.), follow the write rules in
   `AGENTS.md`: **edit frontmatter only, never rewrite the prose body**, and bump the
   `updated` timestamp (set `created`/`updated` on new cards). The board app never writes these.
4. Check the card's acceptance before calling it done, and run the vault's validator if present
   (`bun run validate`, or `node scripts/validate-vault.mjs`) so the board still renders.

## Example

**Input:** "What should I pick up next?"
**Output:** runs the script, then: "**F-001-S-01 — Parse a markdown file and its frontmatter**
(P0, sprint S1, ready: only depends on T-001 which is Done). It's the smallest pure-core leaf
that unblocks the model build. Next ready after it: F-002-S-01, T-002. Want me to start on it?"
