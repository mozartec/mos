---
id: T-032
type: task
title: next_card.py resolves dependencies from body prose, not the dependsOn frontmatter
status: Done
priority: P2
phase: Phase 4
owner: mozart
touches: [skills, scripts]
created: 2026-07-17T19:15:16Z
updated: 2026-07-17T21:10:45Z
---

# T-032 — next_card.py resolves dependencies from body prose, not the dependsOn frontmatter

The mos-next-card ranking script reads a card's dependencies by **scraping the body
prose** for a "Depends on" line, ignoring the `dependsOn` frontmatter field that mos
treats as the authoritative store. In
[`skills/mos-next-card/scripts/next_card.py`](../skills/mos-next-card/scripts/next_card.py),
`depends_on(body)` (line 126) scans body text for `/depends on/i` and pulls ids from it,
and `load()` wires the card's deps straight to it — `"deps": depends_on(body)` (line 168).
The frontmatter field is never read: the script even defines `parse_list` (line 93, the
same helper the validator uses for frontmatter lists) but never applies it to `dependsOn`.

The sibling script does it correctly. [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
reads `fm_deps = parse_list(data.get("dependsOn"))` (line 312) and only falls back to a
prose scrape when the frontmatter is absent — `"deps": fm_deps if fm_deps is not None
else depends_on_prose(body)` (line 326), with `depends_on_prose` documented as a
"Fallback only" (line 158). That behavior landed with
[F-033](F-033-config-declared-card-readiness.md), whose problem statement names this exact
prose-scrape leak — but F-033 was scoped to refine-batch, so `next_card.py` was never
brought in line. The two skills that both compute a ready set now **disagree on where
dependencies live**, and next_card is the one out of step with the data model.

Why it's latent on this vault: our card template restates every dependency in a
`## Dependencies` "**Depends on:**" prose line *in addition to* the frontmatter — e.g.
[`F-001-S-03`](../board/F-001-S-03-resolve-references.md) carries both `dependsOn:
[F-001-S-02, F-002-S-01]` and a matching prose line. The prose scrape happens to find the
same ids, so recommendations look right here. The bug bites the moment the two drift or a
vault follows the documented convention alone:

- A card with `dependsOn` in frontmatter but no prose restatement is read as having **no
  dependencies** — next_card classifies a blocked card as ready and can recommend work
  whose prerequisites aren't done.
- An explicit `dependsOn: []` (a real "none") cannot override a stale prose line, whereas
  refine_batch already treats the empty frontmatter list as authoritative.
- The portable skills install into arbitrary vaults ([`.mos/AGENTS.md`](../.mos/AGENTS.md)
  types `dependsOn` as the frontmatter field; a vault need not use our prose template at
  all), so any vault recording deps only in frontmatter gets wrong recommendations with
  no error.

## Outcome

- `next_card.py` resolves each card's dependencies from the `dependsOn` frontmatter via
  `parse_list`, matching `refine_batch.py`: frontmatter is authoritative, an explicit
  `[]` means "no dependencies", and the body "Depends on" scrape is kept only as a
  fallback for when frontmatter is absent.
- Readiness (`is_ready` / the blocked list) is computed from those resolved deps, so a
  card whose frontmatter dependencies aren't all in the last column is classified blocked
  — regardless of whether the body repeats them.
- Behavior on this vault is unchanged for cards where prose and frontmatter already agree
  (the common case here), so no existing recommendation regresses.
- The installed copy under [`.agents/skills/mos-next-card/`](../.agents/skills/mos-next-card/)
  is regenerated from `skills/` rather than hand-edited (see
  [T-009](T-009-refresh-installed-skills.md)).

## Context — read before starting

- [`skills/mos-next-card/scripts/next_card.py`](../skills/mos-next-card/scripts/next_card.py)
  — `parse_list` (line 93), `depends_on` (line 126), and the `load()` wiring `"deps":
  depends_on(body)` (line 168); `classify()`/`is_ready` consume `c["deps"]`.
- [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
  — the correct pattern to mirror: `depends_on_prose` (line 158) as documented fallback,
  `fm_deps = parse_list(data.get("dependsOn"))` (line 312), and the frontmatter-wins
  selection (line 326). Reuse the same precedence so the two scripts can't drift again.
- [`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md) — its model section
  says "resolves `Depends on:` ids" / "every `Depends on:` id" (lines 37, 45); clarify
  that this is the `dependsOn` frontmatter field (prose is a fallback) so the doc matches
  the fixed behavior.
- [`scripts/refine-batch-readiness.test.mjs`](../scripts/refine-batch-readiness.test.mjs)
  — the model for a next_card readiness test: it drives the script against a fixture vault
  and asserts the `--json` contract. `next_card.py` already supports `--json`.

## Constraints (must honor)

- **Match refine_batch's precedence exactly** — frontmatter `dependsOn` authoritative,
  `[]` is a real "none", prose only when the field is absent. Don't invent a third rule.
- **No behavior change where prose and frontmatter agree** — the fix must leave this
  vault's current recommendations intact; it only corrects the frontmatter-only and
  empty-list cases.
- **Read-only app (ADR-002), config-driven (ADR-003)** — unaffected; this is skill
  tooling. Keep the script dependency-free (stdlib only) and Windows-runnable, consistent
  with the other skill scripts ([T-028](T-028-skills-scripts-windows-portability.md)/
  [T-029](T-029-scripts-tests-windows-portability.md)).
- **Regenerate, don't hand-edit, the installed `.agents/` copy** ([T-009](T-009-refresh-installed-skills.md)).

## Plan

1. In `next_card.py`, resolve deps from frontmatter with a prose fallback (port
   `refine_batch.py`'s `parse_list(data.get("dependsOn"))` + `depends_on_prose`
   precedence); wire `load()` to it instead of `"deps": depends_on(body)`.
2. Add a `scripts/next-card-readiness.test.mjs` mirroring the refine-batch readiness test:
   a fixture (or mutated copy) with a card whose dependency is declared **only** in
   frontmatter asserts that card is classified blocked, and an explicit `dependsOn: []`
   asserts ready even if a prose line lingers. Wire it into `test:scripts`.
3. Clarify the SKILL.md wording to name the `dependsOn` frontmatter field.
4. Regenerate the installed skill copy and run the full check gate.

## Acceptance

- [x] `next_card.py` resolves dependencies from the `dependsOn` frontmatter via
      `parse_list`, with the body scrape as a fallback only — same precedence as
      `refine_batch.py`.
- [x] A card with `dependsOn` in frontmatter and no prose restatement is classified
      blocked (not ready); an explicit `dependsOn: []` is treated as no dependencies.
- [x] Cards where prose and frontmatter already agree produce the same recommendation as
      before (no regression on this vault).
- [x] A `scripts/next-card-readiness.test.mjs` covers the frontmatter-only and empty-list
      cases and runs under `test:scripts`.
- [x] SKILL.md names the `dependsOn` frontmatter field as the dependency source.
- [x] The `.agents/` installed copy is regenerated from `skills/`; the full check gate is
      green.

## Dependencies

- **Depends on:** — . **Related:** [F-033](F-033-config-declared-card-readiness.md) (fixed
  this identical dependency-read defect in refine_batch.py — this card is its `next_card.py`
  counterpart), [T-009](T-009-refresh-installed-skills.md) (installed skills are regenerated,
  not hand-edited), [F-012-S-04](F-012-S-04-critical-path-ready-set.md) (the ready-set /
  dependency semantics this shares).

## Out of scope

- Changing the card template or requiring/removing the prose `## Dependencies` section —
  this only changes how the script *resolves* deps, not how cards are authored.
- Any change to `refine_batch.py` (already correct) beyond keeping the shared precedence
  aligned.
- Transitive/critical-path readiness or graph work (that is F-012's territory).

## References

[`skills/mos-next-card/scripts/next_card.py`](../skills/mos-next-card/scripts/next_card.py),
[`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py),
[`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md),
[`scripts/refine-batch-readiness.test.mjs`](../scripts/refine-batch-readiness.test.mjs),
[`.mos/AGENTS.md`](../.mos/AGENTS.md); [T-009](T-009-refresh-installed-skills.md),
[F-012-S-04](F-012-S-04-critical-path-ready-set.md).
