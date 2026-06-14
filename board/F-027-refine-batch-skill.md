---
id: F-027
type: feature
title: Refine-batch skill — shape the backlog for parallel work
status: Done
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-024]
touches: [skills, docs]
created: 2026-06-12T19:10:00Z
updated: 2026-06-14T08:49:26Z
---

# F-027 — Refine-batch skill — shape the backlog for parallel work

The pick and ship skills *detect* collisions (F-025); nothing yet *prevents* them where
they're created — at card-writing time. A backlog decomposed feature-first piles
"independent" cards onto shared plumbing, and batch math can only answer "one at a
time." After this ships, a third skill — `refine-batch` — raises initial-state cards to
readiness, fills their `touches`, and reshapes overlap clusters into sequenced enablers
plus parallel-safe leaves, under the write rules of
[ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state).

## Outcome

- **A new installable skill** at [`skills/refine-batch`](../skills/), in the same
  layout as its siblings ([`skills/README.md`](../skills/README.md)): config-driven,
  vault-agnostic, refuses to run without a `.mos/config.json`.
- **Three passes over an explicitly named horizon** (e.g. "the next 5 cards", a phase,
  or the whole backlog):
  1. **Readiness** — each card raised to the cold-start standard
     ([ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents),
     [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness): Outcome,
     Context, Constraints, Plan, Acceptance, Out of scope.
  2. **Surfaces** — `touches` filled or corrected against the repo layout and the
     card's plan (F-024's areas).
  3. **Shape** — overlap clusters detected; shared plumbing extracted into sequenced
     enabler cards; features re-sliced into area-disjoint leaves; `dependsOn` edges
     emitted; the pass ends with a proposed conflict-free batch. Splits use the vault's
     hierarchy when the type allows a parent — an oversized card becomes a container
     with child cards
     ([ADR-019](../docs/08-DECISIONS.md#adr-019--subcards-children-are-the-boards-units)),
     not a scatter of siblings; an enabler becomes a child when one parent owns the
     surface, a standalone card when several share it. The reshape recognises the two
     kinds of area from [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c: **hub
     areas** (trunk surfaces every card would otherwise touch — migration snapshots,
     composition roots, catalogs, route manifests) are concentrated, not spread. The
     pattern: per container, one **schema-and-wiring leaf** holds all the hub areas
     once (the shared migration, the registrations, the route/nav stubs) so its
     siblings stay hub-free and fan out; any sibling that genuinely must touch a hub is
     serialised behind that leaf with a `dependsOn` edge and the reason stated on the
     card. **Module areas** (one feature across all layers) leave siblings naturally
     disjoint. The split is a project-specific judgment, not a fixed formula — it reads
     the repo, it never decides by layer. Two signals identify a hub: the **forced-file
     test** — *which single file must every feature edit to register itself?* (ORM
     migration snapshot, DI / composition root, route manifest, permission or command
     catalog — each framework has its own), and **git co-occurrence** — files co-edited
     across otherwise-unrelated changes. Everything else groups as feature × all its
     layers.
- **Write rules enforced mechanically**
  ([ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state)):
  prose edits and splits only on cards still in their type's initial state; everything
  else is untouchable; runs only when explicitly invoked.
- **Conventions updated:** [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) and
  [`AGENTS.md`](../AGENTS.md) describe the refinement stage and its boundary, replacing
  the blanket no-prose phrasing.

## Context — read before starting

- [ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state)
  — the write rules this skill packages; the boundary is a status check.
- [ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)
  and F-024 — the `areas`/`touches` model pass 2 fills and pass 3 optimizes for.
- [ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents)
  and [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness — the
  standard pass 1 raises cards to, and the card template it writes.
- [`skills/next-card/SKILL.md`](../skills/next-card/SKILL.md) /
  [`skills/ship-card/SKILL.md`](../skills/ship-card/SKILL.md) — sibling skills; match
  their structure, config handling, and refusal behavior.
- T-009 — installed copies under `.agents/skills/` are refreshed via the CLI, never
  hand-edited.

## Constraints (must honor)

- **ADR-022 boundary:** prose edits, splits, and new enabler cards only while a card is
  in its type's initial state; cards beyond it get frontmatter-only treatment
  ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)).
- **Explicit invocation:** refinement never runs as a side effect of next-card or
  ship-card.
- **Config-driven, vault-agnostic**
  ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
  initial states, types, areas, and id patterns come from the vault's config; nothing
  assumes this repo's vocabulary.
- **Degrade honestly:** without `areas` config, passes 1–2 still run and pass 3 reports
  that overlap is unknown rather than guessing.
- **Timestamps and ids per [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md):** new
  cards get `created`/`updated`, edits bump `updated`, ids are never reused.

## Plan

1. Author [`skills/refine-batch/SKILL.md`](../skills/) (+ helper script if warranted,
   mirroring `next_card.py`'s config loading): the three passes, the horizon argument,
   the ADR-022 status gate, and the proposed-batch output format.
2. Build the reshape guidance into the skill text: detect overlap clusters from
   `touches`, distinguish hub areas from module areas
   ([`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c) and apply the
   schema-and-wiring-leaf pattern, prefer extracting a shared enabler over serializing
   features, split along the type hierarchy per
   [ADR-019](../docs/08-DECISIONS.md#adr-019--subcards-children-are-the-boards-units)/[ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state),
   emit `dependsOn` edges, stop at acceptance-meeting scope (no gold-plating).
3. Update [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) and
   [`AGENTS.md`](../AGENTS.md) write-rules text per ADR-022.
4. Refresh installed copies via the skills CLI and update `skills-lock.json` (T-009);
   bump versions per [`skills/README.md`](../skills/README.md).
5. Dogfood once on this vault's remaining Draft cards; `bun run validate` after.

## Acceptance

- [x] `skills/refine-batch` exists in the installable layout, is config-driven, and
      refuses to start without `.mos/config.json` — same behavior as its siblings.
- [x] Given a fixture backlog whose initial-state cards share a `touches` area, the
      skill proposes an enabler extraction with disjoint leaves and `dependsOn` edges —
      not a serialized pick order.
- [x] When a split is proposed for a type that allows a parent, the result is a
      container with child cards (ADR-019), not unrelated siblings.
- [x] For a container whose children would all touch a hub area, the proposed split
      yields one schema-and-wiring leaf holding the hub areas with hub-free siblings;
      any sibling forced to touch a hub is serialised behind it with a stated reason.
- [x] It rewrites prose only on cards in their type's initial state; a card in any
      later status is left prose-untouched in the same run (frontmatter-only, ADR-002).
- [x] In a vault without `areas`, passes 1–2 complete and pass 3 states that overlap is
      unknown.
- [x] [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) and
      [`AGENTS.md`](../AGENTS.md) document the refinement stage per ADR-022; installed
      copies are refreshed via the CLI with `skills-lock.json` updated (T-009).
- [x] A refinement run on this vault leaves `bun run validate` green.

## Dependencies

- **Depends on:** F-024 (`touches`/areas must exist for passes 2–3). Pass 3's batch
  output should match F-025's batch semantics, but neither blocks the other.
  **Blocks:** nothing.

## Out of scope

Changing pick/ship behavior (F-025), board UI (F-026), refining cards beyond their
initial state (ADR-022 forbids it), git-computed overlap verification (future ADR), and
auto-running refinement on a schedule or as a hook.

## References

[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-007](../docs/08-DECISIONS.md#adr-007--the-repository-is-the-memory-cards-target-cold-any-model-agents),
[ADR-021](../docs/08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches),
[ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md);
[`skills/README.md`](../skills/README.md); T-009.
