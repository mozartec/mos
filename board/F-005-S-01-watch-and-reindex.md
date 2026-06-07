---
id: F-005-S-01
type: story
title: Watch the vault and re-index changed files
status: Blocked
priority: P1
owner: mozart
sprint: S3
parent: F-005
estimate: M
---

# F-005-S-01 — Watch the vault and re-index changed files

Subscribe to the VaultSource change stream; on a change, re-parse only the affected file
and update the model and views. Blocked on T-004 (the watcher).

Acceptance:
- Changing a card's status on disk moves it on the board without a manual refresh.
