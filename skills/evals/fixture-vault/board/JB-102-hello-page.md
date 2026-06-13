---
id: JB-102
type: job
title: Hello page
status: Queued
priority: Now
parent: EP-100
dependsOn: [JB-101]
touches: [prose]
created: 2026-06-11T09:00:00Z
updated: 2026-06-11T09:00:00Z
---

# JB-102 — Hello page

## Outcome

A `docs/hello.md` page greets readers of the field guide.

## Context — read before starting

- `docs/outline.md` — already lists the hello page; do not edit it.

## Constraints

- Plain markdown only; no HTML.

## Plan

1. Create `docs/hello.md` with a `# Hello` heading and one sentence of welcome text.

## Acceptance

- [ ] `docs/hello.md` exists, starts with a `# Hello` heading, and contains one sentence of welcome text.

## Dependencies

Depends on: JB-101

## Out of scope

- Any change to `docs/outline.md`.
