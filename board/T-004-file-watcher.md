---
id: T-004
type: task
title: File watcher (debounced, atomic-save safe)
status: Todo
phase: MVP
priority: P1
owner: mozart
sprint: S3
---

# T-004 — File watcher

Watch the vault (chokidar in dev). Debounce events; tolerate temp-file+rename saves and a
transient mid-write parse failure with a retry. Emit per-file change events. Blocks F-005-S-01.

## Acceptance
- Editing a file emits exactly one change event after debounce; a broken read retries cleanly.
