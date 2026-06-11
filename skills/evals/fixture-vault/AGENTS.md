# AGENTS.md — Field Notes (eval fixture)

A tiny mos vault used to evaluate the mos skills. Treat it like any user vault:

- The board is `board/`; all vocabulary (types, states, columns) comes from
  `.mos/config.json` — this vault's differs from any other on purpose.
- Card writes are frontmatter only — never rewrite prose; bump `updated`
  (ISO 8601 UTC) on every edit.
- There is no test suite or validator here; verifying a card's `## Acceptance`
  by hand is the full check.
