---
id: TR-220
type: track
title: Trip sharing
status: Underway
priority: Warm
touches: [registry, guide]
created: 2026-06-11T09:00:00Z
updated: 2026-06-12T09:00:00Z
---

# TR-220 — Trip sharing

## Outcome

A user can share a read-only link to a planned trip; the recipient sees the itinerary
without signing in.

## Context — read before starting

- `guide/intro.md` — the shared vocabulary for itineraries.
- The app registry (`app/registry.ts`) — where the share route is registered.

## Constraints (must honor)

- Shared links are read-only; no recipient can edit the trip.
- The share token must not leak the owner's account id.

## Plan

1. Add a `share` adapter that mints a read-only token.
2. Register the public `/t/:token` route in `app/registry.ts`.
3. Document the share flow in the guide.

## Acceptance

- [ ] A trip owner can mint a share link.
- [ ] The link renders the itinerary read-only with no sign-in.
- [ ] The token reveals no account id.

## Dependencies

Depends on: — / Blocks: —

## Out of scope

Editing trips through a shared link; expiring or revoking links (later).
