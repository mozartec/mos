# mos skills — the installable source

This folder is the **distributable source of truth** for the mos agent skills. It uses
the standard `skills/<name>/SKILL.md` layout the [`skills` CLI](https://github.com/vercel-labs/skills)
installs from, so any project can pull them:

```bash
npx skills add mozartec/mos          # pick the skills to install
```

The skills are **vault-agnostic**: everything they know about card types, states,
columns, and sprints is read from the target project's `.mos/config.json` at run time.
No config → the skill tells the user the folder isn't a mos vault and refuses to start.
The only prerequisites in the target project are that file and Python 3 for the bundled
scripts.

| Skill | What it does |
|---|---|
| [`next-card`](next-card/SKILL.md) | Rank the board and recommend the single best next card; hands the confirmed pick to ship-card. |
| [`ship-card`](ship-card/SKILL.md) | Take one named card (any configured type — feature, story, task, …) from id to an open PR. |
| [`refine-batch`](refine-batch/SKILL.md) | Reshape the backlog so parallel-safe work exists: raise not-yet-started cards to readiness, fill `touches`, and split overlap clusters into an enabler plus disjoint leaves (ADR-022). |

## Conventions for skills in this folder

- One folder per skill; the folder name is the skill name in `SKILL.md`'s `name:`.
- Bundled scripts live in the skill's own `scripts/`, zero-dependency Python 3, and must
  be config-driven — nothing vault-specific hardcoded.
- Keep `SKILL.md` short and rule-dense: these run on small models too, so every line has
  to earn its context cost. Project specifics belong in the target vault's `AGENTS.md`
  and docs, not here.
- Each skill ships `evals/evals.json`. Evals run against the shared fixture vault in
  [`evals/`](evals/README.md) — never against this repo's live board, which moves.

## Relation to `.agents/skills/`

`.agents/skills/` is where skills get **installed** (in this repo and in consumers); this
folder is where they're **authored**. This repo consumes its own skills the way any adopter
does: CLI-installed copies under `.agents/skills/` with `skills-lock.json` entries (T-009).
Never edit the installed copies — change `skills/` and reinstall.
