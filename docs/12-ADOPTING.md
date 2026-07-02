---
created: 2026-06-10T11:20:00Z
updated: 2026-07-02T11:35:08Z
---

# Using mos in your project

How to put mos to work in a repo that isn't this one — your app, your notes, your team backlog.
mos has three independently adoptable pieces: the **format** (a folder of markdown plus
`.mos/config.json` — see [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md)), the **app** that renders
it, and the **agent skills** that operate it.

## 1. Make your folder a vault

```bash
npx @mozartec/mos-cli init        # or: mos init [dir]
```

scaffolds the three pieces a vault needs: a starter `.mos/config.json` (feature/task
types, three columns — edit it to your project's vocabulary), `board/` with one example
card showing the frontmatter and readiness shape, and an `AGENTS.md` stub carrying the
write rules. It is a one-time bootstrap: it refuses to run on an existing vault and never
overwrites a file (ADR-013).

Prefer hand-rolling? [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) is the contract, and
[`examples/recipe-box`](../examples/recipe-box/) is a complete, copyable reference.

Everything downstream is config-driven (ADR-003): the app and the skills learn your types
from the config, so nothing here assumes this repo's `F-`/`T-` vocabulary. That includes
pacing: if your team time-boxes, name any enum field — `sprint`, `cycle`,
`iteration` — in `board.scopeField` to scope the board by it
([ADR-020](08-DECISIONS.md#adr-020--board-scope-is-a-config-named-grouping-not-a-built-in-sprint),
[spec §5d](05-VAULT_SPEC.md)); give its values dates and the board opens on the current
one and lists unscheduled work in a backlog. If your team paces by parallel capacity
instead, define no scope. This repo keeps a swap-in example of a scoped config at
[`.mos/config.with-sprints.json`](../.mos/config.with-sprints.json).

If you run several agents at once, the other half of the planning model is parallel
safety: define `areas` (named code surfaces) and let cards declare `touches`, so tooling
can tell which ready cards are collision-free
([ADR-021](08-DECISIONS.md#adr-021--cards-declare-a-physical-surface-parallel-work-is-planned-as-conflict-free-batches)).
The payoff hinges on *sizing* areas by merge risk — hub surfaces vs. per-feature modules,
not one area per app or per layer — which is where a naive setup makes everything look
like it conflicts; [`05-VAULT_SPEC.md`](05-VAULT_SPEC.md) §5c covers how.

## 2. Serve the board and wiki

The CLI (`@mozartec/mos-cli`, ADR-012) bundles the built web app and the read-only vault
endpoints in one Node ≥ 20 process:

```bash
npx @mozartec/mos-cli serve            # nearest vault at or above the current directory
```

It renders the same board, wiki, and graph lenses as this repo's dev setup, live-reloads
on file changes, and refuses to start where no `.mos/config.json` resolves. It is strictly
read-only (ADR-002): every write to the vault happens through your editor or your agent,
never the app. The full command reference — `serve`, `init`, `validate`, ports and flags —
is the [`@mozartec/mos-cli` readme](https://www.npmjs.com/package/@mozartec/mos-cli).

## 3. Install the agent skills

The installable skills live in [`skills/`](../skills/README.md) at this repo's root
(F-014) — what each one does is documented there. Install them with the skills CLI:

```bash
npx skills add mozartec/mos
```

All are vault-agnostic: they read your types, states, columns, and scope from
`.mos/config.json` at run time and refuse to start without it. Pair them with a short
`AGENTS.md` in your repo (again, see the recipe-box example) so cold agents know your
vault's write rules.

## 4. Installing & upgrading

- **CLI** — `npx @mozartec/mos-cli@latest` runs the newest published version (bare `npx`
  reuses an already-installed copy when one resolves); pin one with
  `npx @mozartec/mos-cli@<version>`. A global install upgrades with
  `npm i -g @mozartec/mos-cli@latest`; check what you have with `mos --version` (the
  current release — 0.3.1 at the time of writing — is on
  [npm](https://www.npmjs.com/package/@mozartec/mos-cli)).
- **Skills** — re-run `npx skills add mozartec/mos` to refresh installed skills. The
  target's `skills-lock.json` pins each skill's source and content hash; a re-add updates
  both the files under `.agents/skills/` and the lock entries.
- **Spec** — your vault's `.mos/config.json` declares the format version it targets
  (`specVersion`, [spec §0](05-VAULT_SPEC.md)). The format evolves additively, and
  `mos validate` is spec-version-aware: after upgrading (or when a vault targets a newer
  spec than the installed build understands), re-run it — it warns instead of guessing.

## What you don't need

No database, no service, no account. The folder is the source of truth (ADR-001); git is
the history; deleting `.mos/` cache or uninstalling the app loses nothing.
