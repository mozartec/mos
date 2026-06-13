---
id: EP-106
type: epic
title: Notes data store
status: New
priority: Soon
touches: [data]
created: 2026-06-11T09:00:00Z
updated: 2026-06-11T09:00:00Z
---

# EP-106 — Notes data store

A small on-disk store under `data/` that other notebook features can read and write,
independent of the field-guide pages.

## Outcome

Notes persist as files under `data/` with a documented layout other features build on.

## Context — read before starting

- This epic owns the `data/` area only; the field-guide pages live under `docs/`.

## Constraints

- Files only under `data/`; no change to the field-guide prose.

## Plan

1. Create `data/notes.json` with the documented shape and a loader that reads it.

## Acceptance

- [ ] `data/notes.json` exists with the documented shape and round-trips through the loader.

## Dependencies

None — a standalone leaf epic.
