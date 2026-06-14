---
name: refine-batch
description: >
  Shape a mos vault's backlog so parallel-safe work exists to be picked. Use when the
  user asks to refine, groom, or "get the backlog ready", to raise draft cards to the
  cold-start standard, to fill `touches`, or to break up cards that all pile onto the
  same files so they can run in parallel — in any repo with a `.mos/config.json`;
  requires that file and refuses to start without it. It rewrites prose, splits cards,
  and adds enabler cards ONLY for cards still in their type's initial state (ADR-022);
  decided cards stay frontmatter-only. It proposes a reshape and applies it on your
  confirmation — picking and shipping are next-card's and ship-card's jobs, not this one.
metadata:
  version: 0.1.0
---

# refine-batch

Raise a backlog from "a pile of drafts" to "a set of ready, parallel-safe cards." The
pick and ship skills *detect* collisions; this skill *prevents* them where they're
created — at card-writing time (ADR-021/022). It only refines and proposes; building a
card is ship-card's job.

**Gate first:** this skill only runs inside a mos vault. If there is no `.mos/config.json`
at or above the working directory, tell the user this isn't a mos vault and stop. All
vocabulary — card types, states, columns, areas — comes from that config. Never assume id
prefixes, type names, state names, or area names.

Invoke with an optional horizon: `/refine-batch [horizon]` — e.g. "the next 5 cards", a
phase name, or the whole backlog (the default). Refinement runs **only when asked** —
never as a side effect of next-card or ship-card.

## The one boundary that makes this safe (ADR-022)

Refinement may rewrite prose, split a card, and create enabler cards — but **only for a
card still in its type's *initial* state** (the first state the type declares in config —
the script reports it per type). The moment a card leaves that state it's *decided*: ADR-002
applies unchanged — **frontmatter only, never touch its prose**, even one that shares a
surface with the cluster you're reshaping. The boundary is a status check, so it's
mechanical: the script flags which cards are refinable and which are not. This is what
lets refinement be aggressive without putting decided work at risk.

## 1. Pre-compute with the script

It lives in this skill's own `scripts/` folder — resolve the path from where the skill is
installed:

```bash
python3 <skill-dir>/scripts/refine_batch.py [<vaultDir>] [--phase P] [--limit N] [--json]
```

It discovers the nearest vault, finds each type's initial state, and for every refinable
card in the horizon reports its readiness gaps, its `touches` state, and the **overlap
clusters** — areas declared by two or more refinable cards. Those clusters are the work.
If Python isn't available, apply the model below by reading the config and cards yourself.

Then read the nearest `AGENTS.md` — it carries the vault's non-negotiable constraints and
its card template — before you rewrite anything.

## 2. The three passes

Run them in order over the named horizon; each builds on the last.

### Pass 1 — readiness

Raise every refinable card to the **cold-start standard**
(ADR-007, the vault's conventions §Card readiness): a cold mid-tier agent should execute it from the
card plus its linked docs, no guessing. The script lists each card's missing sections
(Outcome, Context, Constraints, Plan, Acceptance, Out of scope). Fill the gaps from the
card's own intent and the docs it points to — not from invention. A tiny card may
legitimately skip a section; that's your judgment, not a checkbox to force.

### Pass 2 — surfaces

Fill or correct each card's `touches` — the areas it will modify — against the repo
layout and the card's own Plan (the vault's areas & touches conventions, VAULT_SPEC §5c).
Declare the *work*, not the bookkeeping: every card flips its own status, so don't declare
the board area for that. `touches: []` is a real claim ("touches nothing"); leave the
field off only while the surface is genuinely unknown. Without this pass, pass 3 has
nothing to reason over.

### Pass 3 — shape

This is the point of the skill. For each overlap cluster the script found, decide how to
make the work parallel-safe, and **prefer extracting a shared enabler over serializing
features**. Serializing ("do A, then B, then C") throws away parallelism; extracting the
shared surface into one card the others depend on preserves it.

**Hub vs module — read the repo, never decide by layer.** Two kinds of area collide
differently (VAULT_SPEC §5c):

- A **hub area** is a trunk surface any feature must touch to register itself — an ORM
  migration snapshot, the DI / composition root, a route manifest, a permission or
  command catalog. Two hub edits conflict *by construction*. Identify one with the
  **forced-file test** — *which single file must every feature edit to register itself?* —
  and **git co-occurrence** — files co-edited across otherwise-unrelated changes.
- A **module area** is one feature across all its layers (domain → service → API → UI →
  tests). Two different modules are naturally disjoint and batch freely.

**The schema-and-wiring-leaf pattern.** When a cluster of cards would all touch the same
hub, don't spread the hub edit across all of them. Concentrate it: one
**schema-and-wiring leaf** holds every hub area once (the shared migration, the
registrations, the route/nav stubs); its siblings stay hub-free and fan out in parallel.
A sibling that genuinely *must* touch a hub is serialised behind that leaf with a
`dependsOn` edge and the reason stated on the card — the exception, not the rule.

**Split along the hierarchy, not into a scatter.** When a card is oversized and its type
allows a parent, split it into a **container with child cards**
(ADR-019) so the split stays legible on the board — not a handful of unrelated siblings. An enabler
becomes a *child* when one parent owns the surface, a *standalone* card when several share
it. Emit `dependsOn` edges for every sequencing decision. The split is a project-specific
judgment, not a formula.

**Stop at acceptance-meeting scope.** Once the cluster is a sequenced enabler plus
disjoint leaves and each card meets readiness, stop — no gold-plating.

End the pass with the **proposed conflict-free batch**: the leaves that can now run at
once, each with the areas it claims. That batch should match the semantics next-card's
`--parallel` mode would compute (pairwise-disjoint `touches`).

## 3. Degrade honestly

No `areas` configured? Passes 1-2 still run — readiness and `touches` are still worth
doing. But pass 3 reasons **only over the config's declared `areas`**: with none, it has
no surface map, so **do not reshape for overlap and do not claim parallel-safety** — even
if an `AGENTS.md` or a card body *describes* surfaces in prose. Prose is not a checkable
declaration; treating it as one silently re-introduces the guessing this skill exists to
prevent. State plainly that surface overlap is **unknown** and stop there. (A genuinely
oversized card may still be split for *readiness*, but not to engineer a parallel batch
you can't verify.)

## 4. Propose, then apply on confirmation

Refinement is a large, judgment-heavy write across many cards. Don't apply it blind:

1. Present the **reshape plan** — per cluster, what gets the readiness fixes, what gets
   extracted as an enabler, what splits into a container + children, and the resulting
   batch. Keep it short and concrete (ids, the new card titles, the `dependsOn` edges).
2. On the user's confirmation, **apply** the writes (see Write rules). If they redirect,
   adjust the plan — don't charge ahead.
3. After applying, run the vault validator (`bun run validate`, or
   `node scripts/validate-vault.mjs`) so the board still renders: every card maps to a
   column, parents resolve, `touches` names resolve, timestamps are UTC.

## Write rules (always)

- **Prose + frontmatter only on initial-state cards.** Decided cards (any later status)
  are frontmatter-only (ADR-002) — never rewrite their prose.
- **New cards** (enablers, split children) get `created` and `updated` set to now, a fresh
  id (ids are **never reused**), the parent's/cluster's relevant frontmatter, and a body
  that meets readiness. Children carry `parent:`; enablers carry `dependsOn:` where they
  sequence work.
- **Bump `updated`** (UTC, `…Z`) on every card you edit; leave `created` untouched.
- Emit frontmatter in the vault's canonical order (`fieldOrder` in config, or the
  VAULT_SPEC §6 default). Run the validator after — it's the cheap check.

## Hand back

The reshape applied (per cluster: readiness fixes, enablers/splits created with their
ids, `dependsOn` edges), the resulting conflict-free batch with each card's areas, any
cluster left as-is with the reason, and the validator result.
