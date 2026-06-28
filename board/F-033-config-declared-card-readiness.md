---
id: F-033
type: feature
title: Config-declared card readiness — make refine-batch adapt per vault
status: Draft
priority: P1
phase: Phase 4
owner: mozart
dependsOn: [F-027]
touches: [skills, docs, config]
created: 2026-06-28T13:50:20Z
updated: 2026-06-28T13:50:20Z
---

# F-033 — Config-declared card readiness — make refine-batch adapt per vault

`mos-refine-batch`'s pre-compute hardcodes **this** vault's card template into the skill.
[`refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py) pins
`READY_SECTIONS = ["Outcome", "Context", "Constraints", "Plan", "Acceptance", "Out of
scope"]` and `missing_sections()` flags a gap whenever the literal substring `## {section}`
is absent from the body. That set is mos's own *epic-style* template. Any adopter vault
whose cards use a different shape — bold labels (`**Persona:**`, `**Acceptance criteria:**`),
numbered headings (`## 2. Steps`), or a leaner story/task template — is reported as missing
**all six** sections on cards that are in fact complete. Pure false positives, on every
vault but this one. The same leak runs the other way: `depends_on()` scrapes body prose for
the words "depends on" while mos stores dependencies in the frontmatter `dependsOn` field
([`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4), so the script's dependency read is
dead on a standard vault. And [`SKILL.md`](../skills/mos-refine-batch/SKILL.md) names the six
sections in prose *and* tells the agent to read the vault's card template from `AGENTS.md` —
a contradiction the script never resolves.

This is a genericness defect ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)):
the script imposes structure the spec deliberately leaves freeform
([`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4: *"Freeform body. mos never rewrites
this; only frontmatter is machine-managed."*). It hid because mos's only refine fixture uses
the same six-section template the script hardcodes — the dogfood and the eval both match the
bug, so it only surfaces on a real adopter vault with a different template.

The fix keeps readiness **machine-checkable** (the whole "push mechanical load into the
script" direction — cf. [T-027](T-027-refine-batch-script-mechanical-load.md)) but makes its
source the vault's own config: an **optional, per-type, opt-in** readiness declaration, with
an honest degrade to "judge by reading the conventions" when a type declares none — mirroring
how Pass 3 already degrades when no `areas` are declared.

## Outcome

- **A new optional config key**, `types.<type>.card.readiness: ["Outcome", …]` — a per-type
  list of the body sections a ready card of that type carries. It sits inside the existing
  `types.<type>.card` object (which already holds `fields`), documented in
  [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) (§5a/§6). **Freeform body stays the
  default** ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)
  unchanged): a type that omits it declares no required sections. A new ADR records the
  decision — mos adds an *opt-in* machine-readable readiness contract without making body
  structure mandatory anywhere.
- **`refine_batch.py` reads readiness per type from the target config**, hardcoding no
  section names:
  - A type that declares none → the script **skips** its readiness report and prints
    `readiness not declared for <type> — judge by reading the vault's conventions`, instead
    of fabricating six gaps.
  - Heading matching is **flexible**: case-insensitive; accepts `##`/`###` ATX, numbered
    (`## 2. Steps`), and bold-label (`**Steps:**`) forms; a section counts as present only
    when its **content is non-empty** (a bare heading with nothing under it is still a gap).
  - Dependencies are read from the frontmatter `dependsOn` field; body-prose scraping is
    dropped (or kept only as a fallback when `dependsOn` is absent).
- **`SKILL.md`** no longer names the six sections; it describes the discovered-per-type
  behavior and the degrade, and resolves the `AGENTS.md` contradiction (the vault's template
  is the source; the script reports against the declared sections, or defers to the agent
  when none are declared).
- **mos dogfoods its own change:** mos's `.mos/config.json` declares `card.readiness` for its
  feature/story/task types, so this vault keeps its per-section gap report after the
  hardcode is removed.
- **Evals prove both paths** on adopter-shaped fixtures: a vault whose story/task templates
  differ from its epic template reports **zero** readiness gaps on complete cards; a vault
  declaring no readiness still runs Passes 2–3 and prints the degrade note.
- **Discoverability:** the root [`README.md`](../README.md) lists `mos-refine-batch`
  alongside `mos-next-card` and `mos-ship-card` (it currently omits it).

## Context — read before starting

- [`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py)
  — the pre-compute to change: `READY_SECTIONS` (the hardcode), `missing_sections()` (the
  substring match), `depends_on()` (the prose scrape), `load()` (where per-card analysis is
  assembled). Keep it zero-dependency stdlib Python and config-driven.
- [`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md) — Pass 1
  (readiness) names the six sections in prose (the line to rewrite); §1 tells the agent to
  read `AGENTS.md` for the template (the other half of the contradiction).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) — §4 (freeform body — the default this
  preserves), §5a (the field registry and the `card` object), §6 (`config.json`, where
  `card.fields` is documented and `card.readiness` is added).
- [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness — the cold-start
  standard and the *expanded card template* the six sections come from; note that it frames
  them as a convention to skip when they don't apply, not a machine rule.
- [`docs/08-DECISIONS.md`](../docs/08-DECISIONS.md) — the ADR log; add the new ADR after
  [ADR-023](../docs/08-DECISIONS.md#adr-023--intent-lives-in-tracked-decisions-not-comments)
  (next free number).
- [`packages/core/src/validate.ts`](../packages/core/src/validate.ts) — `mos validate`. It is
  lenient (checks spec version, scope, area overlap, card placement) and does **not** reject
  unknown config keys, so it already tolerates `card.readiness`; any shape check added here is
  optional polish (see Out of scope).
- [`skills/mos-refine-batch/evals/evals.json`](../skills/mos-refine-batch/evals/evals.json)
  and [`skills/evals/refine-fixture-vault/`](../skills/evals/refine-fixture-vault/) — the
  existing refine eval and its fixture; note the fixture's thin cards are graded against the
  same six sections, which is why this never surfaced. See
  [`skills/evals/README.md`](../skills/evals/README.md) for how evals run cold.
- [`skills/README.md`](../skills/README.md) (already lists the skill) and
  [`README.md`](../README.md) (root — does **not**); authoring rules in
  [`skills/README.md`](../skills/README.md): vault-generic, config-driven, zero-dep Python.
- [T-027](T-027-refine-batch-script-mechanical-load.md) — the sibling task on the same
  surface; see Dependencies for sequencing.

## Constraints (must honor)

- **Vault-generic ([ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
  F-014).** Every readiness section name comes from the target's `.mos/config.json`; the
  script must hardcode no section, type, state, or area name and must produce correct results
  on a vault whose templates differ entirely from this one.
- **Freeform body stays the default ([ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)).**
  `card.readiness` is opt-in; a type that omits it has no required sections and the body stays
  freeform. mos still **never writes** card bodies — readiness is a *report*, not enforcement.
- **Honest degrade.** No `card.readiness` for a type → skip its readiness report and say so;
  never fabricate gaps. This mirrors Pass 3's no-`areas` degrade, which must stay unchanged.
- **Zero-dependency Python**, stdlib only, as today; the SKILL's manual fallback still applies
  when Python is absent.
- **Don't regress what already adapts.** Vault discovery; config-driven
  columns/types/states/areas/priority; the initial-state "refinable" boundary
  ([ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state));
  the `touches`/overlap-cluster analysis; the no-`areas` degrade — all unchanged.
- **Timestamps and ids** per [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md): edits bump
  `updated` (UTC `…Z`); no id is reused.

## Plan

1. **Spec + ADR.** Document `types.<type>.card.readiness` (optional array of section names) in
   [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5a/§6, stating freeform body remains
   the default. Add an ADR after ADR-023 recording the opt-in machine-readable readiness
   contract and why it doesn't compromise the freeform-body rule. Add a one-line pointer in
   [`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md) §Card readiness from the convention to
   the config key.
2. **Script.** In `refine_batch.py`: read `card.readiness` per type from config; replace
   `missing_sections()` with a per-type, flexible matcher (case-insensitive; ATX/numbered/
   bold-label; content-non-empty); emit the degrade note for types that declare none; read
   `dependsOn` from frontmatter (fallback to prose only if absent). Keep `--json` shape
   additive where consumers exist.
3. **SKILL.md.** Rewrite Pass 1 to describe the discovered-per-type readiness and the degrade;
   remove the six hardcoded names; resolve the `AGENTS.md`-vs-script contradiction.
4. **Dogfood.** Add `card.readiness` to mos's own feature/story/task types in
   [`.mos/config.json`](../.mos/config.json) so this vault keeps its gap report.
5. **Evals.** Add fixtures: (a) a vault with per-type templates — stories use bold labels,
   tasks use numbered headings — asserting **zero** false gaps on complete cards; (b) a vault
   declaring no readiness — asserting Passes 2–3 still run and the degrade note prints. Run
   cold per [`skills/evals/README.md`](../skills/evals/README.md).
6. **README.** Add `mos-refine-batch` to the root [`README.md`](../README.md) skills list.
7. **Install + validate.** Regenerate the installed copies under `.agents/skills/` and
   `skills-lock.json` (T-009 flow; `.claude/skills/*` stay symlinks); `bun run validate` this
   repo.

## Acceptance

- [ ] `types.<type>.card.readiness` is documented in
      [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) as an optional per-type array, with
      freeform body stated as the default; a new ADR records the decision.
- [ ] A vault whose story/task templates differ from its epic template (bold labels, numbered
      headings) reports **zero** readiness gaps on cards that are actually complete.
- [ ] A vault (or type) declaring no readiness still runs Passes 2–3 and prints
      `readiness not declared for <type> — judge by reading …` instead of fabricating gaps.
- [ ] Heading matching is case-insensitive and accepts ATX (`##`/`###`), numbered (`## 2.
      Steps`), and bold-label (`**Steps:**`) sections; a heading with empty content counts as
      a gap.
- [ ] `dependsOn` is read from frontmatter (prose scrape removed or fallback-only).
- [ ] `SKILL.md` no longer names the six sections, describes the per-type behavior and the
      degrade, and the `AGENTS.md`/script contradiction is gone.
- [ ] The `touches`/overlap-cluster output and the no-`areas` degrade are unchanged on the
      existing fixture.
- [ ] mos's `.mos/config.json` declares `card.readiness` for its types; this vault still
      reports per-section gaps and `bun run validate` is green.
- [ ] The root `README.md` lists `mos-refine-batch` alongside the other two skills.
- [ ] Installed copies + `skills-lock.json` regenerated and byte-matching; evals run cold.

## Dependencies

- **Depends on:** [F-027](F-027-refine-batch-skill.md) — the skill these changes extend
  (Done).
- **Related (sequence, do not parallelize):** [T-027](T-027-refine-batch-script-mechanical-load.md)
  also edits `refine_batch.py`, `SKILL.md`, and the refine evals — both share the `skills`
  surface, so they collide and must run one after the other. They overlap on one point:
  reading `dependsOn` from frontmatter. Whichever ships first lands that read; the second
  rebases onto it rather than re-deriving it.
- **Blocks:** nothing.

## Out of scope

- **Validator shape-checking of `card.readiness`** (warn when it isn't an array of non-empty
  strings) — the lenient validator already tolerates the key, so this is optional polish in
  `core`; a separate small card if wanted (it would add `core` to `touches`).
- **mos writing or auto-filling card bodies** — readiness stays a report; ADR-002 holds.
- **T-027's scope** — ready-set, conflict-free batch, area fan-in, canonical field order,
  area-shape calibration — beyond the shared `dependsOn`-from-frontmatter read.
- Changes to `mos-next-card` / `mos-ship-card`; any board UI.

## References

[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer),
[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type),
[ADR-022](../docs/08-DECISIONS.md#adr-022--backlog-refinement-may-reshape-cards-that-havent-left-their-initial-state);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md);
[`docs/09-CONVENTIONS.md`](../docs/09-CONVENTIONS.md);
[`skills/mos-refine-batch/SKILL.md`](../skills/mos-refine-batch/SKILL.md);
[`skills/mos-refine-batch/scripts/refine_batch.py`](../skills/mos-refine-batch/scripts/refine_batch.py);
[`skills/README.md`](../skills/README.md); F-027; T-027; F-014; F-024.
