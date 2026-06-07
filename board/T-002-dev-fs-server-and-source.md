---
id: T-002
type: task
title: Dev filesystem server + HttpVaultSource
status: Planned
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# T-002 — Dev filesystem server + HttpVaultSource

Add `apps/dev-server`: a small Node server that reads a configured vault path (list/read
files) and exposes a change stream, proxied from the Angular dev server. Implement
`HttpVaultSource` against the `VaultSource` interface already defined in `packages/core`
(T-001), and swap it in for the `StaticVaultSource` stub.

## Acceptance
- The app loads a real folder's files through `HttpVaultSource`; no direct disk access in
  the UI, and `packages/core` stays pure.

## Dependencies
- Depends on: T-001. Blocks: F-005 (live reload needs the change stream).
