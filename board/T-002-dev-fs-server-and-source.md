---
id: T-002
type: task
title: Dev filesystem server + VaultSource adapter
status: Planned
phase: MVP
priority: P0
owner: mozart
sprint: S1
---

# T-002 — Dev filesystem server + VaultSource adapter

A small Node dev server that reads a configured vault path (list/read files) and exposes a
change stream, proxied from the Angular dev server. Define the `VaultSource` interface and
its `HttpVaultSource` implementation.

## Acceptance
- The app loads a real folder's files through `VaultSource`, no direct disk access in the UI.
