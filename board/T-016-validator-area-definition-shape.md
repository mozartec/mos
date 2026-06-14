---
id: T-016
type: task
title: Validator — flag malformed area definitions
status: Todo
priority: P3
phase: Phase 4
owner: mozart
dependsOn: [T-012]
touches: [scripts]
created: 2026-06-14T17:26:46Z
updated: 2026-06-14T17:26:46Z
---

# T-016 — Validator — flag malformed area definitions

[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c defines `areas` as "a map of
vault-defined names to glob lists," but nothing checks the shape. In
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) the area-compile step
coerces and filters silently — `(Array.isArray(globs) ? globs : [globs]).filter((g) =>
typeof g === 'string')` — so an area whose value is a number, an object, or an array with
a non-string entry compiles to fewer (or zero) regexes, quietly matches nothing, and
vanishes from overlap detection (T-012) with no diagnostic. A validator exists to surface
exactly that misconfiguration. This adds the cheap shape check.

## Outcome

- The validator **errors** when an `areas` entry isn't a list of glob strings — a
  non-array value, or an array containing a non-string — naming the offending area. A
  malformed area is broken config, treated like the existing unknown-column and
  enum-without-`values`/`source` errors, not the glob-overlap *warning* (which is a design
  smell on otherwise-valid config).
- The shape check runs **independently of** the overlap check, which needs ≥2 areas — so a
  single malformed area is still caught.
- Well-formed `areas`, and a vault with no `areas`, produce no new error or warning and the
  same exit code as before.
- Ships with tests under the harness T-011 establishes, so it can't silently regress.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c — `areas` is a map of names to
  glob *lists*; the shape this enforces.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the `validateAreaOverlap`
  area-compile step that silently drops non-strings (added by T-012), and the existing
  error style to match (unknown-area `touches`, the type/column/parent errors).
- T-012 — added the area-glob-overlap check this sits beside; build on its area handling.
- T-011 — the validator test suite these tests belong to; land on top of it.
- [ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type)
  — config-driven: validate structure generically, never this repo's specific area names.

## Constraints (must honor)

- **Error, not warning.** A malformed area definition is broken config (consistent with
  unknown-column / enum-without-`values`); the overlap design-smell stays a warning.
- **Shape only.** Flag that a value isn't an array of strings; do **not** validate glob
  *syntax* or judge area granularity (not statically decidable — a planning call, §5c).
- **Additive.** Well-formed and area-less vaults stay error- and warning-free; no change to
  exit codes for already-clean vaults.
- **Lands with tests** (T-011): the new rule gets fixtures proving malformed shapes error
  and well-formed/empty configs do not.

## Plan

1. Add a shape check (e.g. `validateAreas(cfg.areas, errors)`) called from `validateVault`
   independently of the overlap check: for each area, push an error if its value isn't an
   array, or if any entry isn't a string — naming the area (and the offending value).
2. Leave `validateAreaOverlap`'s defensive coercion in place; the error is now raised
   regardless, so nothing is dropped without a report.
3. Add fixtures/tests under T-011's suite: a non-array area value errors; an array with a
   non-string entry errors; a single malformed area errors (overlap check doesn't run); a
   well-formed area and a no-`areas` vault stay clean.
4. `bun run validate` on this repo stays clean (its areas are already well-formed).

## Acceptance

- [ ] An area whose value is not an array of strings (a non-array value, or an array with a
      non-string entry) produces an error naming the area; a well-formed area does not.
- [ ] The shape check fires even for a single area, independent of the ≥2-area overlap
      check.
- [ ] A vault with no `areas`, and one with only well-formed `areas`, produce no new
      error/warning and the same exit code as before.
- [ ] This repo validates clean.
- [ ] The behavior is covered by tests in the validator suite (T-011), failing the build on
      regression.

## Dependencies

- **Depends on:** T-012 (extends the area-compile code it added; both touch `scripts`, so
  sequence them, not parallel) and lands on the T-011 test harness.

## Out of scope

Validating glob *syntax* (beyond "is a string"), scoring area granularity/coarseness, the
glob-overlap check itself (T-012), the unknown-area `touches` error and the in-flight
overlap warning (F-024, unchanged), and graduating any of this into `packages/core`
(future, with F-002).

## References

[ADR-003](../docs/08-DECISIONS.md#adr-003--a-card-is-folder-scope--a-recognized-frontmatter-type);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c;
[`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs); T-012; T-011; F-024.
