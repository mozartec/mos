---
id: F-029
type: feature
title: mos validate — surface the vault validator as a CLI command
status: Draft
priority: P2
phase: Phase 4
owner: mozart
dependsOn: [T-017]
touches: [cli]
created: 2026-06-14T18:29:34Z
updated: 2026-06-14T18:29:34Z
---

# F-029 — mos validate — surface the vault validator as a CLI command

The `mos` CLI
([ADR-012](../docs/08-DECISIONS.md#adr-012--the-cli-a-published-node-runnable-package-bundling-the-web-app),
published as `@mozartec/mos-cli` —
[ADR-014](../docs/08-DECISIONS.md#adr-014--the-cli-publishes-as-mozartecmos-cli-on-npmjs))
serves and scaffolds vaults but offers **no way to validate one**. Adopter repos — and the
mos skills (T-018) — need a portable validator they can run **without** this repo's
`bun run validate` / `scripts/validate-vault.mjs`. This feature adds `mos validate`: a thin,
read-only command over core's `validateVault` (graduated in T-017).

## Outcome

- `mos validate [dir]` validates a vault (or discovers every vault under the cwd when no
  `dir` is given), prints the same report `bun run validate` produces, and **exits non-zero
  when any vault has errors** — a CI gate in any repo that has the CLI.
- The command reuses core's `validateVault` (no third validator) and **surfaces the
  supported spec range** so a version mismatch is visible to the user.
- Validate is **read-only** (ADR-002): it never writes.

## Context — read before starting

- [`apps/cli/src/args.ts`](../apps/cli/src/args.ts) — `parseArgs` + `HELP`; add the
  `validate` command and its optional `[dir]` arg in the existing `serve`/`init` style.
- [`apps/cli/src/main.ts`](../apps/cli/src/main.ts) — command dispatch; add the `validate`
  branch (mirrors how `serve` resolves and discovers a vault).
- [`apps/cli/src/find-vault.ts`](../apps/cli/src/find-vault.ts) — vault discovery to reuse
  for the no-arg and single-dir cases.
- `packages/core` `validateVault` (delivered by **T-017**) — the logic to call; import from
  `@mos/core`.
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) — the report format and
  exit-code contract to match (after T-017 it is the I/O shell over the same core function).
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §0 — the supported spec range to
  surface.
- [ADR-012](../docs/08-DECISIONS.md#adr-012--the-cli-a-published-node-runnable-package-bundling-the-web-app),
  [ADR-014](../docs/08-DECISIONS.md#adr-014--the-cli-publishes-as-mozartecmos-cli-on-npmjs),
  [ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer).

## Constraints (must honor)

- **Build on core (depends on T-017).** Call core's `validateVault`; do not re-implement it
  or wrap the standalone script.
- **Read-only (ADR-002).** No writes during validate.
- **Output parity.** The report and exit-code semantics match `bun run validate` (errors →
  non-zero) so CI and the skills can rely on either entry point.
- **Bundles cleanly.** Works in the published bundle (`bun build --target node`) and from
  source; no new runtime deps beyond core.
- **Make the version visible.** `validate` (and/or `--help`/`--version`) states the spec
  range the CLI validates, and a newer-vault mismatch shows the T-017 warning.

## Plan

1. `args.ts`: add `ValidateArgs { command: 'validate'; dir?: string }` and parse
   `validate [dir]` (reject unknown options like `serve` does). Extend `HELP` with the
   `validate` usage line.
2. `main.ts`: add the `validate` branch — resolve `dir` (or cwd), discover the vault(s),
   call core's `validateVault` on each, print the report, and `process.exit(non-zero)` if
   any vault has errors.
3. Surface the supported spec range in the report header and/or `--version`.
4. Update [`apps/cli/package.json`](../apps/cli/package.json) `description` to mention
   `validate`.
5. Tests (`bun test`, beside `args.test.ts`/`serve.test.ts`): `parseArgs` handles
   `validate [dir]` and rejects bad options; an integration test runs `validate` against a
   fixture vault — clean → exit 0, a vault with an error → non-zero, a newer-spec vault →
   warning shown.

## Acceptance

- [ ] `mos validate` validates the nearest/discovered vault(s) and exits 0 when clean,
      non-zero when any vault has errors.
- [ ] `mos validate <dir>` validates that vault; its output matches `bun run validate`'s
      report for the same vault.
- [ ] The command calls core's `validateVault` (T-017), not a copy of the script.
- [ ] `mos --help` lists `validate`; the supported spec range is visible (report or
      `--version`), and a newer-spec vault shows the T-017 warning.
- [ ] New CLI tests pass, and the command works in the built bundle.
- [ ] `validate` performs no writes (ADR-002).

## Dependencies

- **Depends on:** T-017 (needs core's `validateVault`). **Blocks:** T-018 (the skills
  reference `mos validate`).

## Out of scope

Graduating the validator (T-017), the skills rewrite (T-018), new validation rules, and any
auto-fixing — `validate` only reports.

## References

[`apps/cli/src/args.ts`](../apps/cli/src/args.ts);
[`apps/cli/src/main.ts`](../apps/cli/src/main.ts);
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §0;
[ADR-012](../docs/08-DECISIONS.md#adr-012--the-cli-a-published-node-runnable-package-bundling-the-web-app);
[ADR-014](../docs/08-DECISIONS.md#adr-014--the-cli-publishes-as-mozartecmos-cli-on-npmjs);
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer);
T-017; T-018.
