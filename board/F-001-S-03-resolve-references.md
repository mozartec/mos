---
id: F-001-S-03
type: story
title: Resolve references by id
status: Todo
priority: P0
owner: mozart
sprint: S2
parent: F-001
estimate: M
---

# F-001-S-03 — Resolve references by id

Find references in a body — markdown links, bare ids (see F-002), and optional [[F-002]] —
and resolve each to a target card/doc by id.

Acceptance:
- "see F-002" resolves to F-002 regardless of a markdown link existing.
- Resolution is by id, surviving file renames. Id shape comes from config regex.
