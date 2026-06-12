---
created: 2026-06-12T18:30:00Z
updated: 2026-06-12T18:30:00Z
---

# Personas

Who mos serves, one level deeper than the vision's single paragraph
([`01-VISION.md`](01-VISION.md)). Three archetypes recur in every design decision; when
they pull in different directions, the orchestrator wins.

## The orchestrator (primary)

A solo developer who plans by talking to an AI and ships by running coding agents —
often several at once. Their work is paced by **integration capacity**: how many
parallel changes can land without colliding, not by a calendar cadence. The board is a
command center, not a ceremony — what's in flight, what's ready, what would collide if
started now. Time-boxes add nothing to this workflow, which is why scope grouping is
optional
([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint))
and conflict-free parallel batches are the planning primitive
([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)).

## The very small team

Two to five people, each working alongside their own agents, sharing one vault in one
repo. They may keep a light cadence and they bring their own word for it — sprint,
cycle, iteration — so the scope field is theirs to name and date
([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint)).
What they need from mos: conventions an agent can follow cold, and a board anyone can
read without a tracker account.

## The agent

A coding agent — assume mid-tier and cold-started — is a *user* of the vault, not a
feature of it. It reads cards as contracts
([ADR-007](08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents)):
self-sufficient context, explicit constraints, acceptance that defines done, and a
declared file surface (`touches`,
[ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches))
so its work can be scheduled alongside others' without collisions. The conventions in
[`09-CONVENTIONS.md`](09-CONVENTIONS.md) are written to keep this user on rails.

## How these stay honest

mos is dogfooded: this repo is a vault, and friction found while operating it is
recorded as a card or an ADR rather than fixed silently. When a concept goes unused or a
bottleneck shows up in practice, the spec changes — that feedback loop, not interviews,
is this project's UX research.
