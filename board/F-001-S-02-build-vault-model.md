---
id: F-001-S-02
type: story
title: Build the in-memory vault model
status: Planned
priority: P0
owner: mozart
sprint: S1
parent: F-001
estimate: M
---

# F-001-S-02 — Build the in-memory vault model

From a set of parsed files, assemble the vault model: docs, cards (by id), and the type
of each card. Pure function: `buildModel(files, config) -> Model`.

Acceptance:
- Cards are keyed by `id`; duplicate ids are reported.
- Files in board scope without a recognized type are flagged "not a card", not dropped.
