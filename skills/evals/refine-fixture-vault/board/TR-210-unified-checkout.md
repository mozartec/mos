---
id: TR-210
type: track
title: Unified checkout across flights, hotels, and cars
status: Sketch
priority: Hot
touches: [registry, flights, hotels, cars]
created: 2026-06-11T09:00:00Z
updated: 2026-06-11T09:00:00Z
---

# TR-210 — Unified checkout across flights, hotels, and cars

One checkout that can pay for a flight, a hotel, and a car together. Each of the three
modules needs a checkout adapter under its own folder, and the shared checkout flow has
to be registered once in `app/registry.ts` so every module routes through it. Big — spans
the registry plus all three modules.
