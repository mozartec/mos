---
id: T-018
type: task
title: Make the mos skills self-contained — no host-repo references
status: Done
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-029]
touches: [skills]
created: 2026-06-14T18:29:34Z
updated: 2026-06-20T19:54:46Z
---

# T-018 — Make the mos skills self-contained — no host-repo references

The mos skills install into **any** repo with a `.mos/config.json` (F-014), but they aren't
fully portable yet. `mos-refine-batch` tells the agent to run `bun run validate` /
`node scripts/validate-vault.mjs` — this repo's task and this repo's file — and all three
`SKILL.md` files, plus the bundled Python scripts, cite `ADR-NNN` and `VAULT_SPEC §N`.
None of those exist in an adopter repo, so an agent burns tokens hunting for docs that
aren't there. This task makes the **shipped** skill surface self-contained: the only
external tool a skill may name is the **mos CLI** (now that F-029 adds `mos validate`).

## Outcome

- The skills' validation step runs `mos validate` (F-029): prefer the installed CLI, fall
  back to `npx @mozartec/mos-cli validate`, and degrade to a by-hand model check when no CLI
  is present — relaying a spec mismatch, never gating on it.
- No `SKILL.md` or bundled script references a file/doc an adopter repo lacks: every
  `ADR-NNN` / `VAULT_SPEC §N` citation is **inlined** as the one-line rule it stands for, or
  **removed** if not load-bearing.
- The installed copies (`.agents/skills/mos-*`) and `skills-lock.json` are regenerated from
  `skills/` (the T-009 flow); the `.claude/skills/*` symlinks are unchanged.

## Context — read before starting

- [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md) §4.3 + Hand back
  — the `bun run validate` / `scripts/validate-vault.mjs` references to replace.
- [`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md) §6 — already generic
  ("the project's full checks … include the vault validator if it has one"); mirror the
  `mos validate` hint here.
- [`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md),
  [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md),
  [`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md) — the `ADR-NNN` /
  `VAULT_SPEC §N` citations to inline-or-remove.
- [`skills/mos-next-card/scripts/next_card.py`](../skills/mos-next-card/scripts/next_card.py),
  [`skills/mos-ship-card/scripts/ship_card.py`](../skills/mos-ship-card/scripts/ship_card.py),
  [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
  — the `bun run validate` comments and the `ADR-NNN` / `VAULT_SPEC §N` mentions in comments
  to scrub ("script or not").
- F-029 — provides `mos validate`; this task depends on it.
- F-014 — portable agent skills; the portability standard this completes.
- [`skills/README.md`](../skills/README.md) — the authoring rule this enforces ("scripts are
  zero-dep Python, config-driven, nothing vault-specific hardcoded") and the
  authoring-vs-installed relationship.
- T-009 — the install/regeneration procedure (CLI local-path `--copy`, normalize the lock
  `source` to the `mozartec/mos` GitHub form, `.claude/skills/*` symlinks into
  `.agents/skills/`).

## Constraints (must honor)

- **Only the mos CLI may be named** as an external tool. No `bun run X`, no `scripts/*.mjs`,
  no `docs/` paths, and no `ADR-NNN` / `VAULT_SPEC §N` citations anywhere in the shipped
  surface — `SKILL.md` **and** the bundled scripts that run in adopter repos.
- **Preserve guarantees when inlining.** For each removed citation, the rule it encoded must
  still be stated inline, or be demonstrably non-load-bearing — itemized one-per-line in the
  PR body.
- **Validation is best-effort, never a gate.** `mos validate` present → run it and relay the
  result (including a spec-mismatch warning); absent → by-hand model check; never block the
  skill on a missing or old CLI.
- **`npx` uses the full package name** — `npx @mozartec/mos-cli validate`. Bare `npx mos`
  fetches the wrong package when the CLI isn't already installed locally.
- **Don't change skill behavior**, only its references: the methodology (initial-state
  boundary, `touches`/parallel batches, frontmatter-only writes) stays; its citations move
  inline.
- **Never hand-edit installed copies.** Change `skills/`, then reinstall (T-009).

## Plan

1. `mos-refine-batch/SKILL.md`: replace the `bun run validate` / `scripts/validate-vault.mjs`
   instruction with — run `mos validate <dir>` (installed) / `npx @mozartec/mos-cli validate
   <dir>` (fallback) / by-hand model check (no CLI), relaying any spec-mismatch warning.
   Update the Hand-back validator mention to match.
2. Mirror the `mos validate` hint into `mos-ship-card/SKILL.md` §6's "vault validator if it
   has one."
3. Sweep all three `SKILL.md` files for `ADR-NNN` / `VAULT_SPEC §N`: inline the one-line rule
   each stands for (e.g. "frontmatter-only on decided cards" for `ADR-002`; "the areas a card
   declares it will modify" for `VAULT_SPEC §5c`), or delete if redundant.
4. Scrub the same citations and the `bun run validate` mentions from the three `.py` files'
   comments (reword to "the mos vault validator" where the provenance note is worth keeping).
5. Regenerate the installed copies and lock per T-009 (CLI local-path `--copy` install;
   normalize the lock `source` to `mozartec/mos`), leaving `.claude/skills/*` symlinks.
6. Dogfood: run `mos validate` (or `bun run validate`) on this repo after edits, and run the
   skills' evals against the fixture vault to confirm behavior is unchanged.

## Acceptance

- [x] `grep -rE 'ADR-|VAULT_SPEC|bun run|scripts/validate|\.mjs' skills/*/SKILL.md
      skills/*/scripts/*.py` returns nothing; the only external tool named is the mos CLI.
- [x] Each removed citation's rule is still stated inline or was non-load-bearing — itemized
      one-per-line in the PR body (guarantee preservation).
- [x] `mos-refine-batch`'s validation step uses `mos validate` / `npx @mozartec/mos-cli
      validate` with a by-hand fallback and treats the result as advisory (no hard gate);
      `mos-ship-card` §6 mirrors the hint.
- [x] `.agents/skills/mos-*` and `skills-lock.json` are regenerated from `skills/`; installed
      copies byte-match source; `.claude/skills/*` are still symlinks.
- [x] The skills pass their evals against the fixture vault (behavior unchanged), and this
      repo validates clean.

## Dependencies

- **Depends on:** F-029 (the skills reference `mos validate`, which F-029 adds).

## Out of scope

Graduating the validator (T-017), adding the CLI command (F-029), changing skill
methodology, scrubbing the dev-only `evals/` strings (they're test descriptions, not shipped
guidance — optional, lower priority), and the `.angular`/`.turbo` entries in the scripts'
`IGNORE` sets (harmless no-ops in other repos).

## References

[`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md);
[`skills/mos-ship-card/SKILL.md`](../skills/mos-ship-card/SKILL.md);
[`skills/mos-next-card/SKILL.md`](../skills/mos-next-card/SKILL.md);
[`skills/README.md`](../skills/README.md); F-029; F-014; T-009.
