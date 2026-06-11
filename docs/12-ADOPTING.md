---
created: 2026-06-10T11:20:00Z
updated: 2026-06-11T11:00:00Z
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
from the config, so nothing here assumes this repo's `F-`/`T-` vocabulary.

## 2. Serve the board and wiki

The CLI (`@mozartec/mos-cli`, ADR-012) bundles the built web app and the read-only vault endpoints
in one Node ≥ 20 process:

```bash
npx @mozartec/mos-cli serve            # nearest vault at or above the current directory
npx @mozartec/mos-cli serve ./docs --port 5000
# or: npm i -g @mozartec/mos-cli  →  mos serve
```

It renders the same board, wiki, and graph lenses as this repo's dev setup, live-reloads
on file changes, and refuses to start where no `.mos/config.json` resolves. It is strictly
read-only (ADR-002): every write to the vault happens through your editor or your agent,
never the app.

## 3. Install the agent skills

The installable skills live in [`skills/`](../skills/README.md) at this repo's root
(F-014): `next-card` recommends what to work on; `ship-card` takes a named card to an open
PR. Install them with the skills CLI:

```bash
npx skills add mozartec/mos
```

Both are vault-agnostic: they read your types, states, columns, and sprints from
`.mos/config.json` at run time and refuse to start without it. Pair them with a short
`AGENTS.md` in your repo (again, see the recipe-box example) so cold agents know your
vault's write rules.

## What you don't need

No database, no service, no account. The folder is the source of truth (ADR-001); git is
the history; deleting `.mos/` cache or uninstalling the app loses nothing.
