---
id: T-025
type: task
title: Cold-adopter consistency pass on the adoption docs (`12-ADOPTING.md`)
status: Todo
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [F-029, F-030]
touches: [docs]
created: 2026-06-20T21:15:27Z
updated: 2026-06-20T21:15:27Z
---

# T-025 — Cold-adopter consistency pass on the adoption docs (`12-ADOPTING.md`)

[`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md) is the human walkthrough for putting mos in a
repo that isn't this one — the doc a person reads before running `init` and installing the
skills. It must match the shipped surface exactly, because a wrong command or package name in
the first five minutes is where adoption stalls. The CLI now has three commands
(`init` / `serve` / `validate`, F-029) and scaffolds a framework guide (F-030); the skills
install via `npx skills add mozartec/mos`. This task walks the adoption docs as a brand-new
adopter would and fixes any drift between what they say and what the tools actually do — prose
only, no behavior change.

## Outcome

- Every command, flag, and package name in `12-ADOPTING.md` matches the shipped CLI: the
  three commands appear and read correctly, `npx @mozartec/mos-cli …` / `mos …` forms are
  accurate, and the skills line is `npx skills add mozartec/mos`.
- The doc's claims about what `init` scaffolds (`.mos/config.json`, `board/` with one card,
  the `AGENTS.md` stub, **and** the `.mos/AGENTS.md` framework guide from F-030) match what
  `init` actually writes.
- Cross-links resolve: pointers to `05-VAULT_SPEC.md`, the ADRs (anchor slugs), and
  `examples/recipe-box` are valid; the docs map in [`docs/00-README.md`](../docs/00-README.md)
  lists `12-ADOPTING.md` and describes it correctly.
- Any drift that can only be fixed *outside* docs (the emitted framework guide → `init.ts`,
  area `cli`, T-023; a skill → area `skills`, T-024) is recorded as a finding, not edited here.

## Context — read before starting

- [`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md) — the doc under review. Read it end to end as
  a cold adopter; check each command block, package name, and cross-link.
- [`apps/cli/src/init.ts`](../apps/cli/src/init.ts) — ground truth for what `init` scaffolds
  (the `write(...)` calls); confirm the doc's "scaffolds the three pieces" description and the
  framework-guide mention are accurate. **Read only** — fixing the scaffolder is T-023.
- [`apps/cli/package.json`](../apps/cli/package.json) — the published name (`@mozartec/mos-cli`)
  and the `bin` (`mos`); the doc's invocation forms must match.
- [`docs/00-README.md`](../docs/00-README.md) — the docs map; confirm the `12-ADOPTING.md`
  entry exists and its one-line description still fits.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — the spec the doc links for the
  hand-roll path; confirm the link + section anchors resolve.
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Links — file/ADR mentions are markdown
  links (ADRs use anchor slugs), bare ids only for cards; keep edits to that standard.
- F-029 (`mos validate`), F-030 (the scaffolded guide) — the shipped behavior the doc must
  reflect.

## Constraints (must honor)

- **Docs only.** Edits land under `docs/` (and, if needed, root `*.md`). Do **not** edit
  `apps/cli/**` (T-023's `cli`), `.mos/**` (`config`), or `skills/**` (T-024's `skills`) —
  that would break the parallel-safe split. Out-of-area drift is a recorded finding.
- **Consistency, not redesign.** Fix wrong/stale facts and broken links; don't restructure the
  adoption story or duplicate the spec (the doc points to `05-VAULT_SPEC.md`, it doesn't
  restate it).
- **Verify against the tools, not memory.** Each command/claim is checked against `init.ts` /
  `package.json` / the spec before it's called correct.
- **Link style per conventions** — markdown links for files/ADRs (ADR anchor slugs), bare ids
  for cards.
- **Doc timestamps** — bump the `updated` frontmatter of any doc you edit (ADR-010); the app
  never writes these.

## Plan

1. Read `12-ADOPTING.md` top to bottom as a new adopter; list every command, package name,
   scaffold claim, and cross-link.
2. Check each against ground truth (`init.ts`, `package.json`, `05-VAULT_SPEC.md`, the skills
   install line); note matches vs. drift.
3. Fix in-doc drift (wrong commands, stale package names, broken links, inaccurate scaffold
   description); bump the doc's `updated`.
4. Confirm `00-README.md` lists and describes `12-ADOPTING.md` correctly; fix if not.
5. Record any out-of-area drift as findings routed to T-023 (guide/`init.ts`) or T-024 (skills).
6. `bun run validate` (link/board sanity) and a quick render check of the edited docs.

## Acceptance

- [ ] Every command, flag, and package name in `12-ADOPTING.md` matches the shipped CLI
      (three commands; correct `@mozartec/mos-cli` / `mos` forms; `npx skills add mozartec/mos`).
- [ ] The doc's description of what `init` scaffolds matches `init.ts` (including the F-030
      framework guide).
- [ ] All cross-links in the doc resolve (spec, ADR anchors, `examples/recipe-box`);
      `00-README.md` lists `12-ADOPTING.md` accurately.
- [ ] Only `docs/` (and root `*.md`) changed; any out-of-area drift is recorded as a finding
      for T-023 / T-024; edited docs have `updated` bumped; `bun run validate` is clean.

## Dependencies

- **Depends on:** F-029, F-030 (the shipped surface the doc must reflect). **Blocks:** nothing.

## Out of scope

Editing the framework-guide template or any `apps/cli/**` code (T-023); editing the skills or
their docs under `skills/**` (T-024); rewriting `.mos/AGENTS.md` (`config`); restructuring the
adoption narrative or adding new docs — this is a consistency pass, not a rewrite.

## References

[`docs/12-ADOPTING.md`](../docs/12-ADOPTING.md); [`docs/00-README.md`](../docs/00-README.md);
[`apps/cli/src/init.ts`](../apps/cli/src/init.ts);
[`apps/cli/package.json`](../apps/cli/package.json);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md); F-029; F-030.
