---
id: T-025
type: task
title: Consolidate the usage/adoption docs — one source per fact, add install/upgrade, keep it brief
status: Todo
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-029, F-030]
touches: [docs]
created: 2026-06-20T21:15:27Z
updated: 2026-06-20T21:52:47Z
---

# T-025 — Consolidate the usage/adoption docs — one source per fact, add install/upgrade, keep it brief

mos's "what it is / how to use it" story is spread across [`README.md`](../README.md),
[`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md), [`docs/01-VISION.md`](../docs/01-VISION.md),
[`apps/cli/README.md`](../apps/cli/README.md), and the framework guide — and the install
commands and the one-line pitch are **restated in several**. It's both duplicated and
incomplete: there is no install/**upgrade** content anywhere (nothing on `@latest`, re-running
`npx skills add`, the skills-lock, or a `specVersion` bump). This task makes the docs direct
and brief: each fact lives in exactly one canonical place and everything else links to it, the
adoption walkthrough gains a short upgrade section, and net lines come down. Prefer trimming to
adding — don't over-document.

## Two README surfaces (not duplication to delete)

The repo ships **two purpose-built readmes** and we keep them separate (decided in T-023):
root [`README.md`](../README.md) is the **GitHub project landing** (the whole product — format +
app + skills), and [`apps/cli/README.md`](../apps/cli/README.md) is the **npm package page** (npm
renders the package readme, not the repo root). Each must stand alone for its platform, so the
one-line pitch + the install/quickstart are **deliberately repeated in both** — that overlap is
intentional, not something this card removes. Everything *else* is single-sourced and linked. The
CLI readme is `cli` (T-023's area) — **don't edit it here**; treat it as canonical and link to it.

## Canonical home per fact (everything else links, never restates)

- **Commands** (`init`/`serve`/`validate`, flags) → [`apps/cli/README.md`](../apps/cli/README.md)
  — the npm-facing, current reference (documents `validate` + `--version`/`--help`). Root README
  and `12-ADOPTING.md` **link** to it; neither restates the command table.
- **How to operate a vault** (write rules, lenses) → the framework guide (`.mos/AGENTS.md`,
  source in `init.ts`). **Read-only here** (`cli`/`config`, T-023): link, don't restate.
- **The format/spec** → [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md).
- **What mos is / why** → one short statement in `README.md` (and the same short pitch in the CLI
  readme — the accepted overlap); the deeper version in
  [`docs/01-VISION.md`](../docs/01-VISION.md). Said once per surface, not scattered across docs.

## Outcome

- `README.md` is a brief front door that still stands alone as the GitHub landing: a short pitch,
  a minimal start (the pitch + install/quickstart is the accepted overlap with the npm readme), and
  pointers — but **no** restated command table and **no** duplicated adoption walkthrough (link to
  the CLI readme and `12-ADOPTING.md` for those). Trim duplication, don't gut it to a bare link.
- `docs/12-ADOPTING.md` is the single adoption walkthrough, trimmed of anything that duplicates
  the CLI readme or the framework guide (link instead), and it **gains a concise Installing &
  upgrading section**:
  - CLI: `npm i -g @mozartec/mos-cli@latest` (global) vs pinning via `npx`; how to check the
    installed version.
  - Skills: re-run `npx skills add mozartec/mos` to update; what `skills-lock.json` pins and how
    a refresh works.
  - Spec: `.mos/config.json` declares `specVersion`; what a bump means and that `mos validate`
    is spec-version-aware — re-run it after upgrading.
- Each fact (what it is · install · the commands · how to upgrade) appears in exactly one place;
  the others link. `docs/00-README.md` still maps everything to its home.
- Net lines removed ≥ added where possible; no new doc files.

## Context — read before starting

- [`README.md`](../README.md) — root readme (Why / How it works / Run it / Documentation / Agent
  skills …); the main duplication source to trim to a front door.
- [`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md) — the adoption walkthrough to consolidate +
  extend with the upgrade section.
- [`apps/cli/README.md`](../apps/cli/README.md) — the canonical command reference to link to
  (already lists `init`/`serve`/`validate`). **Do not edit** (T-023's `cli` area).
- [`docs/00-README.md`](../docs/00-README.md) — the docs map; keep its entries pointing at the
  right home.
- [`docs/01-VISION.md`](../docs/01-VISION.md) — the canonical "what mos is / why"; README's short
  pitch should defer here, not compete.
- [`skills/README.md`](../skills/README.md) — the install line (`npx skills add mozartec/mos`)
  and the lock behavior the upgrade section describes (read-only; it's `skills`, T-024's area).
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Links — markdown links for files/ADRs
  (ADR anchor slugs), bare ids for cards; §Timestamps — bump `updated` on edited docs (ADR-010).

## Constraints (must honor)

- **Docs only.** Edits land in `docs/**` and root `*.md`. Do **not** edit `apps/cli/**`
  (T-023's `cli`), `.mos/**` (`config`), or `skills/**` (T-024's `skills`) — link to them as
  canonical homes; if one needs a change, record it as a finding for T-023 / T-024.
- **Single source of truth.** A fact is stated once; everywhere else links to it (the same
  no-duplication rule the repo already applies to `AGENTS.md`/`CLAUDE.md`).
- **Direct and brief.** Prefer deleting duplication to writing more; no new doc files unless one
  replaces more than it adds. The bar is "enough to explain what it is, how to use it, what's
  there" — not exhaustive.
- **Verify against the shipped surface.** Commands, package names, and the version referenced in
  the upgrade section are checked against the real CLI, not memory.
- **Bump `updated`** on every doc you edit; this card's own `updated` when ticking Acceptance.

## Plan

1. Inventory where the one-line pitch, the install commands, and the adoption steps appear
   (README, 12-ADOPTING, 01-VISION, apps/cli/README, framework guide); assign each fact its
   canonical home (table above).
2. Trim `README.md` to a front door: short pitch (defer to VISION), fastest start, pointers;
   delete the restated command/adoption detail, replace with links.
3. Trim `docs/12-ADOPTING.md` to the one walkthrough; replace duplicated command/operate detail
   with links to the CLI readme and the framework guide.
4. Add the Installing & upgrading section to `docs/12-ADOPTING.md` (CLI `@latest`, skills re-add
   + lock, `specVersion` bump), verified against the real commands/version.
5. Fix `docs/00-README.md` map entries; bump `updated` on edited docs.
6. `bun run validate`; record any out-of-area fixes (CLI readme, guide, skills) as findings for
   T-023 / T-024.

## Acceptance

- [ ] The command reference and the adoption walkthrough each live in exactly one canonical place
      (CLI readme; `12-ADOPTING.md`); other docs link rather than restate. The pitch +
      install/quickstart may appear once per README surface (root + npm) and nowhere else.
- [ ] `README.md` is a brief front door that still stands alone as the GitHub landing — no
      duplicated command table or adoption walkthrough, but not gutted to a bare link.
- [ ] `docs/12-ADOPTING.md` has a concise Installing & upgrading section (CLI `@latest`,
      re-running `npx skills add` + `skills-lock.json`, `specVersion` bump), verified against the
      shipped commands/version.
- [ ] Net lines removed ≥ added where feasible; no new doc files; only `docs/` + root `*.md`
      changed; out-of-area fixes recorded as findings for T-023 / T-024.
- [ ] Edited docs have `updated` bumped; cross-links resolve; `bun run validate` is clean.

## Dependencies

- **Depends on:** F-029, F-030 (the shipped surface the docs describe). **Sequencing:** best done
  *after* the 0.3.0 CLI release so the upgrade section cites a real published version and a
  command that works (T-023 → release → this). **Blocks:** nothing.

## Out of scope

Editing the CLI readme or any `apps/cli/**` (T-023); the framework guide / `init.ts` / `.mos/**`
(`config`); the skills or `skills/**` (T-024); rewriting `01-VISION.md` or `05-VAULT_SPEC.md`;
adding new doc files. This is consolidation + the upgrade section, not a docs rewrite.

## References

[`README.md`](../README.md); [`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md);
[`docs/00-README.md`](../docs/00-README.md); [`docs/01-VISION.md`](../docs/01-VISION.md);
[`apps/cli/README.md`](../apps/cli/README.md); [`skills/README.md`](../skills/README.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md); F-029; F-030.
