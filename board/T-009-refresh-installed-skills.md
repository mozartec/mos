---
id: T-009
type: task
title: Refresh installed skills — single source of discovery
status: In Progress
priority: P1
phase: Phase 2
owner: mozart
dependsOn: [F-014]
created: 2026-06-10T19:55:00Z
updated: 2026-06-11T20:15:58Z
---

# T-009 — Refresh installed skills — single source of discovery

`npx skills add mozartec/mos` currently offers **three** skills, not two: the superseded
router skill at `.agents/skills/mos/` is discovered alongside the real `skills/` pair.
This task completes the "refresh later" cleanup F-014 deferred, so consumers see exactly
`ship-card` and `next-card`.

## Outcome

Skill discovery on this repo offers exactly two skills. The old `.agents/skills/mos/`
family is gone; the repo itself consumes the `skills/` versions the way any other project
would — installed via the skills CLI with `skills-lock.json` entries — and `AGENTS.md`
describes the layout truthfully.

## Context — read before starting

- **Why three skills appear** (vercel `skills` CLI discovery rules, per its README):
  the CLI scans many container dirs including `.agents/skills/`, not just `skills/`; a
  `SKILL.md` at a shallower level *shadows* nested ones (so the router's nested
  `next-task`/`ship-card` ride along inside "mos" instead of listing separately); and
  skills recorded in `skills-lock.json` as installed from other repos (turborepo,
  daisyui, angular-*) are not offered, while the hand-committed `mos/` family — with no
  lock entry — is.
- [`skills/README.md`](../skills/README.md) — the authored source of truth and its
  relation to `.agents/skills/`.
- [`AGENTS.md`](../AGENTS.md) §Agent skills — references `.agents/skills/mos/` and the
  `mos/next-task` skill; must be rewritten to point at the installed `skills/` versions.
- [`board/F-014-portable-agent-skills.md`](F-014-portable-agent-skills.md) — declared
  this refresh out of scope, to be done "in a later pass". This is that pass.

## Constraints (must honor)

- **One authored source.** `skills/` remains the only place mos skills are written;
  everything under `.agents/skills/` must be a CLI-managed install (lock entry present),
  never hand-edited.
- **Don't break the other installed skills** — turborepo, daisyui, angular-developer,
  angular-new-app and their lock entries stay untouched.
- **Keep guidance working.** Any doc that routed agents to `mos/next-task` (root
  `AGENTS.md`, possibly nested ones) must route to the new skill names instead — grep,
  don't assume.

## Plan

1. Delete `.agents/skills/mos/` entirely (router + nested next-task/ship-card + scripts).
2. Install the two authored skills into this repo with the skills CLI
   (`npx skills add mozartec/mos`, or the local-path form if offline), selecting
   `ship-card` and `next-card`, so `.agents/skills/` gains CLI-managed copies with
   `skills-lock.json` entries.
3. Update `AGENTS.md` §Agent skills: the mos skills are authored in `skills/` and
   installed like any third-party skill; point "what to work on next" guidance at
   `next-card` and card-shipping guidance at `ship-card`. Grep the repo for
   `.agents/skills/mos` and `mos-next-task`/`mos-ship-card` references and fix all hits.
4. Verify discovery: run `npx skills add` against the repo (or a fresh clone) and
   confirm exactly `next-card` and `ship-card` are offered.

## Acceptance

- [ ] `.agents/skills/mos/` no longer exists and no file in the repo references it
      (grep for `.agents/skills/mos`, `mos-next-task`, `mos-ship-card` is clean).
- [ ] `ship-card` and `next-card` are installed under `.agents/skills/` by the skills
      CLI, recorded in `skills-lock.json` like the other installed skills.
- [ ] Skill discovery against the repo offers exactly two skills — verified by actually
      running the installer.
- [ ] `AGENTS.md` (and any nested agent guide) routes agents to the new skill names;
      `bun run validate` passes.

## Dependencies

- **Depends on:** F-014. **Blocks:** —

## Out of scope

Changing the authored skills' content (they shipped with F-014), publishing the CLI
(T-008), and the third-party skills under `.agents/skills/`.

## References

F-014; `skills/README.md`; vercel-labs/skills README (discovery and shadowing rules).
