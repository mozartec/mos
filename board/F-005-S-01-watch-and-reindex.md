---
id: F-005-S-01
type: story
title: Watch the vault and re-index changed files
status: Todo
dependsOn: [T-004, T-002, F-001]
created: 2026-06-07T13:00:00Z
updated: 2026-06-09T20:18:00Z
priority: P1
owner: mozart
sprint: S3
parent: F-005
estimate: M
---

# F-005-S-01 — Watch the vault and re-index changed files

Subscribe to the VaultSource change stream; on a change, re-parse only the affected file
and update the model and views. Blocked on T-004 (the watcher).

## Outcome

The app subscribes to `VaultSource.watch(...)`; on each change it reads the one changed file,
re-runs the F-001 parse for it, merges the result into the in-memory model (add/update/remove
the card or doc), and the signal-based views reflect it with no refresh. Unsubscribes cleanly
on teardown.

## Context — read before starting

- [`packages/core/src/vault-source.ts`](../packages/core/src/vault-source.ts) — `watch`
  returns an unsubscribe fn; honor it.
- [`docs/03-ARCHITECTURE.md`](../docs/03-ARCHITECTURE.md) §Data flow #5.
- F-001 (parse + model update functions to reuse per file) and T-004 (the event source).

## Constraints (must honor)

- Read-only; re-index only. (ADR-002)
- Incremental: re-parse just the changed file and patch the model; don't rebuild the whole
  vault. (ADR-001)
- Update model immutably so signals detect the change; always unsubscribe on destroy.

## Plan

1. On view/app init, call `VaultSource.watch(onChange)`; store the unsubscribe.
2. `onChange(path)` → `readFile(path)` → `parseFile` → patch the model (handle create,
   update, delete) → emit via signal.
3. Tear down the subscription on destroy. Test: a simulated change event moves a card.

## Acceptance

- [ ] Changing a card's status on disk moves it on the board without a manual refresh.
- [ ] Only the changed file is re-parsed; the rest of the model is untouched.
- [ ] The watch subscription is disposed on teardown (no leaks).

## Dependencies

- **Depends on:** T-004, T-002, F-001. **Blocks:** —

## Out of scope

The watcher/debounce/atomic-save handling (T-004) and writes. App-side subscribe + re-index
only.

## References

ADR-001, ADR-002; `docs/03-ARCHITECTURE.md`; `packages/core/src/vault-source.ts`.
