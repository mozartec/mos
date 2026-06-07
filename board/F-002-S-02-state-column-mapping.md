---
id: F-002-S-02
type: story
title: Apply the type state-to-column mapping
status: Todo
priority: P0
owner: mozart
sprint: S2
parent: F-002
estimate: M
---

# F-002-S-02 — Apply the type state→column mapping

Given a card, compute its board column from its type's `states` map. States mapped to null
are hidden; multiple states may share a column.

Acceptance:
- A Deferred/Dropped card is excluded from the board.
- A Blocked story lands in In Progress and is marked as blocked.
