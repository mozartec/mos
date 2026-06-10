---
id: F-014
type: feature
title: Portable agent skills
status: Done
priority: P1
phase: Phase 2
owner: mozart
created: 2026-06-10T10:33:00Z
updated: 2026-06-10T10:43:48Z
---

# F-014 — Portable agent skills

mos ships its agent skills as an installable product. A `skills/` folder at the repo root
holds the distributable source of truth — `ship-card` and `next-card` — written to run on
**any** mos vault, so other projects (e.g. an ERP repo with its own card types) can install
them with the standard skills CLI instead of copying repo-specific files.

## Outcome

After this feature, the repo root has a `skills/` folder (the layout the `skills` CLI
installs from, like `vercel/turborepo` or `saadeghi/daisyui`):

```
skills/
├── README.md            # what these are, how to install them into another project
├── ship-card/           # SKILL.md + scripts/ship_card.py
└── next-card/           # SKILL.md + scripts/next_card.py
```

The skills are vault-agnostic by construction:

- **Config is the gate.** Both skills read types, states, columns, and sprints from
  `.mos/config.json`. If no config exists at or above the working directory, the skill
  tells the user the folder is not a mos vault and refuses to start.
- **No hardcoded vocabulary.** No `F-`/`T-` prefixes, no type names, no column or state
  names, no repo-specific commands baked into the skill prose or scripts.
- **`ship-card` accepts a card type.** It can be invoked on a feature, a story, a task, or
  whatever the vault's config defines. Shipping a container card (one with children) is
  allowed — its unfinished children become the scope — instead of being rejected.
- **Concise.** The skill bodies are stripped to the rules that matter so they stay cheap
  in context for smaller models.

The installed copies under `.agents/skills/mos/` stay as they are for now; they get
refreshed from `skills/` in a later pass.

## Context — read before starting

- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) — card readiness, statuses, and
  timestamps the skills must teach.
- [`.agents/skills/mos/ship-card/SKILL.md`](../.agents/skills/mos/ship-card/SKILL.md) and
  [`.agents/skills/mos/next-task/SKILL.md`](../.agents/skills/mos/next-task/SKILL.md) — the
  current skills these distill; their bundled scripts are the starting point.
- [`AGENTS.md`](../AGENTS.md) — documents where skills live; must map the new folder.
- [`.mos/config.json`](../.mos/config.json) — `skills/**` markdown must not leak into the wiki.

## Constraints (must honor)

- **Config-driven, never hardcoded** (ADR-003) — all vocabulary from `.mos/config.json`.
- **Frontmatter-only writes** (ADR-002) — the skills must keep teaching the narrow write
  rule: status/`updated` in frontmatter, plus ticking the card's own `## Acceptance` boxes.
- **Zero dependencies in scripts** — plain Python 3 stdlib, so they run anywhere.
- **Keep installed skills untouched** — `.agents/skills/mos/` is refreshed later, not now.

## Plan

1. Create `skills/ship-card/` and `skills/next-card/` (SKILL.md + `scripts/`), adapted
   from the installed mos skills: shorter prose, generic project-check wording, hard gate
   on a missing `.mos/config.json`.
2. `ship-card`: accept `/ship-card [<type>] <id>`; validate the type against the config
   and the card; treat container cards as shippable with children in scope.
3. Scripts: derive priority ranking from the config's priority field when defined; report
   children of a container card instead of refusing it.
4. `skills/README.md` — purpose, layout convention, install instructions.
5. Exclude `skills/**` from the wiki in `.mos/config.json`; map `skills/` in `AGENTS.md`;
   reflect the feature in the roadmap snapshot.

## Acceptance

- [x] `skills/ship-card/SKILL.md` and `skills/next-card/SKILL.md` exist at the repo root,
      named `ship-card` and `next-card`, each with its bundled script under `scripts/`.
- [x] Both skills and scripts take types, states, columns, and sprints from
      `.mos/config.json` and refuse to start when no config is found — verified by running
      the scripts in a folder without one.
- [x] `ship-card` accepts an optional card type, validates it against the config, and
      treats a container card as shippable (children in scope) rather than rejecting it.
- [x] Skill bodies are concise — no repo-specific build commands; generic "run the
      project's checks" wording with the vault's own files as the source of specifics.
- [x] `.agents/skills/mos/` is byte-for-byte unchanged.
- [x] `skills/**` is excluded from the wiki, `AGENTS.md` maps the new folder, and
      `bun run validate` passes.

## Dependencies

- **Depends on:** — **Blocks:** —

## Out of scope

Updating or removing the installed `.agents/skills/mos/` copies (a later refresh).
Publishing the skills anywhere beyond this repo. New skills beyond the two named.

## References

ADR-002, ADR-003; `docs/09-CONVENTIONS.md`.
