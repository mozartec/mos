---
id: F-031
type: feature
title: Board shows in-flight cards from unmerged branches (local git, no API auth)
status: Draft
priority: P2
phase: Phase 4
owner: mozart
touches: [core, server, web]
created: 2026-06-14T20:13:02Z
updated: 2026-06-14T20:13:02Z
---

# F-031 — Board shows in-flight cards from unmerged branches (local git, no API auth)

The board renders the checked-out branch (usually `main`). During a parallel batch each
agent flips its card to an in-progress state on its **own unmerged branch**, so the `main`
board keeps showing the pre-batch world — it's blind to in-flight work exactly when "who's
working on what / what would collide" matters most (the command-center promise,
[`14-PERSONAS.md`](../docs/14-PERSONAS.md) §17). The fix that fits mos's local-first model
reads in-flight state from **git refs, not a remote API**: after a normal `git fetch`, every
open branch is a local remote-tracking ref, so the board can overlay in-flight state using
only local git data and the credentials the `fetch` already used — no GitHub/Azure token,
which keeps it working for **private repos**.

## Outcome

- The board overlays, per card, an **in-flight** indicator derived from unmerged
  `<type>/<id>` branches: for each such ref, read the card's status at that ref; if it's an
  in-progress state the merged board doesn't show, mark the card in-flight and name the
  branch.
- Works on **local git data only** — local branches + remote-tracking refs after a fetch. No
  host API, no stored credentials; private repos work because `fetch` uses the user's normal
  git auth.
- Read-only (ADR-002) and core-pure (ADR-001): the server reads refs (I/O), core computes the
  overlay (pure), the web app renders it.

## Context — read before starting

- [`docs/14-PERSONAS.md`](../docs/14-PERSONAS.md) §17 — the board as a command center: "what's
  in flight, what's ready, what would collide." This closes the gap between that promise and
  reality during a parallel batch.
- F-026 (Done) — collision badges read in-flight overlap from the vault's status on the
  *current* branch; this extends "in-flight" to span unmerged branches and should feed the
  same collision logic.
- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c and the `<type>/<id>-slug` branch
  convention (mos-ship-card) — the branch→card mapping the scan relies on.
- `packages/vault-server` and [`apps/cli`](../apps/cli) — the server hosting the board, where
  the git-ref scan (I/O) lives.
- `packages/core` — where the pure overlay model + compare live.
- [ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database)
  (core pure — git I/O stays in the server/CLI),
  [ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer)
  (read-only — only reads refs).

## Constraints (must honor)

- **Local git only — no host API, no credential storage.** Read `refs/heads` +
  `refs/remotes` (post-fetch). Private repos work via the user's existing git auth on
  `fetch`. Host-API integration (PR review state, Azure DevOps, click-through) is a separate,
  heavier decision — see Out of scope.
- **Core stays pure (ADR-001).** Git ref reading is I/O → server/CLI; core receives parsed
  card states and computes the overlay.
- **Read-only (ADR-002).** Never write a ref or a card.
- **Convention-bound mapping.** Branch→card via `<type>/<id>`; refs/cards that don't match
  are simply not overlaid — never guessed.
- **Don't block render.** Scanning refs must be bounded or async so the board stays
  responsive; stale-but-fast beats slow. Degrade to no-overlay when the vault isn't a git
  repo or git is unavailable.

## Plan

1. Server/CLI: list candidate refs (local + remote-tracking) matching `<type>/<id>`, and for
   each read the card file at that ref (`git show <ref>:<path>`) → its status.
2. Core: a pure compare — given the merged card states + the per-ref states, produce an
   in-flight overlay (which cards are in progress on which branches, and whether that differs
   from merged).
3. Web: render the overlay — an "in flight on `<branch>`" indicator distinct from the card's
   merged column position; optionally a "show in-flight" filter.
4. Feed the in-flight set into F-026's collision logic so "what would collide" accounts for
   cross-branch work, not just same-branch status.
5. A refresh trigger (manual, or on file-watch / after a fetch) so the overlay updates
   without a restart.

## Acceptance

- [ ] With a card set to an in-progress state on an unmerged branch (local, or
      remote-tracking after a fetch), the board shows it as in-flight while `main` still lists
      it as not-started — using no host API or stored token.
- [ ] A private repo works with only the user's normal git credentials (the `fetch`); no
      GitHub/Azure API auth required.
- [ ] Core's overlay logic is pure and unit-tested; git ref reading lives in the server/CLI
      (ADR-001); nothing is written (ADR-002).
- [ ] Refs/cards not matching `<type>/<id>` are ignored, not guessed; a non-git vault degrades
      to no overlay.
- [ ] Board render stays responsive with the scan enabled (bounded or async).

## Dependencies

- **Builds on:** F-026 (in-flight collision badges). No hard dependency on a PR-link field.

## Out of scope (deliberately — heavier, separate decisions)

- **Host-API integration + auth** — querying GitHub or Azure DevOps for PR *review* state
  (approved / changes-requested) or any stored API credential. That adds network to a
  local-first tool: its own card **and an ADR**, not this one.
- A **`pr:` frontmatter field** linking a card to its PR URL — cheap, but only needed for
  click-through, not for the overlay; separate card if wanted.
- Cloud-agent branches never fetched to the user's machine — if a branch is neither a local
  nor a remote-tracking ref, it can't be read locally; that's the API path's job.

## References

[`docs/14-PERSONAS.md`](../docs/14-PERSONAS.md) §17;
[`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §5c;
[ADR-001](../docs/08-DECISIONS.md#adr-001--the-markdown-folder-is-the-source-of-truth-no-database);
[ADR-002](../docs/08-DECISIONS.md#adr-002--the-app-is-read-only-writes-happen-in-the-agent-layer);
F-026.
