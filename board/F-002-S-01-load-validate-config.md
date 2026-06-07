---
id: F-002-S-01
type: story
title: Load and validate .mos/config.json
status: Planned
priority: P0
owner: mozart
sprint: S1
parent: F-002
estimate: S
---

# F-002-S-01 — Load and validate .mos/config.json

Read the config, apply defaults for missing optional keys, and validate: every type's
states map to a real column or null; parent rules nest at most one level.

Acceptance:
- A malformed config produces clear errors, not a crash.
- A parent type pointing at a type that itself has a parent is rejected.
