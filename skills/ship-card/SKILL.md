---
name: ship-card
description: >
  Ship one mos board card end-to-end — pre-flight, plan, branch, build, commit, push, open
  a PR. Use when the user names a card id and wants it built: "/ship-card F-004-S-01",
  "ship T-003", "finish RB-007". Works on any card type the vault's `.mos/config.json`
  defines; requires that file and refuses to start without it. When no card has been
  chosen yet, use next-card instead.
metadata:
  version: 0.4.0
---

# ship-card

Take one board card from its id to an open pull request.

**Gate first:** this skill only runs inside a mos vault. If there is no `.mos/config.json`
at or above the working directory, tell the user this isn't a mos vault and stop. All
vocabulary — card types, states, columns — comes from that config. Never assume id
prefixes, type names, state names, or column names.

Invoke with the card id: `/ship-card <id>` — the type comes from the card's frontmatter,
and any configured type is shippable. A **container card** (other cards point at it via
`parent:`) is shipped by delivering its unfinished children — they are in scope.

## 1. Pre-flight

Run the bundled script (it lives in this skill's own `scripts/` folder — resolve the path
from wherever the skill is installed):

```bash
python3 <skill-dir>/scripts/ship_card.py <id> [--json]
```

It locates the card, prints the branch name, resolves parent/dependencies/children with
file paths, and flags soft spots. Then read the card file fully, the docs/ADRs it links,
and the nearest `AGENTS.md` — it carries the vault's non-negotiable constraints.

## 2. Plan — and raise doubts before building

Write a short plan: what changes, which files, how each Acceptance bullet will be proven.
**Stop and ask the user** if any of these is true:

- no `## Acceptance`, or the card is too thin to execute from without guessing;
- a dependency isn't in the last column;
- the card's status maps to no column (hidden — deferred/dropped states);
- the card contradicts a doc, an ADR, or the actual code;
- the scope is ambiguous, or honestly doing it touches things the card doesn't mention;
- real risk: schema/format breaks, destructive changes, security-sensitive paths.

A pause must carry a concrete, answerable question — scope, alternatives, and risk are
the user's calls. If nothing bites, say "no blockers" and continue **without waiting**.

## 3. Branch and mark In Progress

- **If a harness already put you on a work branch, stay on it.** Cloud/GitHub agents are
  often only allowed to push to the branch they were given — creating another fights
  permissions and can drop your card edit. The branch name is cosmetic; never switch.
- Only when starting from the up-to-date default branch, create the name the script
  printed: `<label>/<id>-<slug>` — the card's type label from the config, lower-cased;
  the id keeps its casing (e.g. `story/F-004-S-01-render-columns`).
- Set the card's `status` to the state that maps to an in-progress column and bump
  `updated` (ISO 8601 UTC). Frontmatter only.

## 4. Build

Only what the card scopes — its "Out of scope" is binding. Never touch another card's
status or prose, even one that looks done. Iterate with the project's cheap scoped checks
(the project's own AGENTS/README names them); save the full suite for the end. When every
Acceptance bullet is genuinely verified, stop — no gold-plating. Failures in code the
card never touched are pre-existing: note them, don't chase them.

## 5. Self-review the diff

Before finishing, read the full diff once as a **reviewer, not the author**. Beyond the
obvious bug hunt, two checks earn their cost:

- **Generalizations keep their special case's guarantees.** If the build replaced a
  special case with a general mechanism, list what the special case enforced and verify
  each behavior is preserved — a test per behavior beats a hopeful diff.
- **Untested guard code is where regressions land.** If the change touched validation
  or other guard logic that has no tests, say so in the PR body.

Then give every finding exactly one disposition — none are dropped silently:

1. **Fix now** — in scope and cheap: do it before finishing.
2. **Record** — where the next worker will actually read it: on the card that will
   consume the finding, if the vault's write rules allow reshaping that card (never
   rewrite the prose of decided cards); otherwise a new card; at minimum in the PR body.
3. **Accept** — with the rationale stated in the PR body.

## 6. Finish, commit, PR

1. Run the project's full checks **once** (include the vault validator if it has one).
2. Close the card: `python3 <skill-dir>/scripts/ship_card.py <id> --finish` — sets the
   Done status, bumps `updated`, ticks the card's own `## Acceptance` boxes. Always
   close via the script; never hand-edit the status, timestamp, or boxes.
3. Fold that edit into the **final commit**. Commits and the PR title are Conventional
   Commits (squash-merge friendly): `<type>(<area>): <summary>` — `feat` for new
   behavior (most stories), `fix`, `docs`, `refactor`, `test`, or `chore`/`ci`/`build`
   for plumbing; breaking changes use `!`.
4. Write the PR body: reference the card id and map each Acceptance bullet to the check
   that proved it. When the change has a user-visible surface, add a **How to test**
   section a reviewer who doesn't know the code can follow — derive it from Acceptance.
   If the repo has a PR template (`.github/PULL_REQUEST_TEMPLATE.md`, or on Azure DevOps
   `pull_request_template.md` under `.azuredevops/`, `.vsts/`, `docs/`, or the root),
   fill its sections — CLI `--body`/`--description` flags bypass the platform's
   auto-fill, so read the file yourself. Template or not, these sections are a floor,
   not a ceiling: also record anything review needs — deviations from the card's plan
   (and why), pre-existing issues you found, what was deliberately left out of scope.
5. Push and open the PR. If the repo defines labels (`gh label list`), pass the matching
   area/type ones via `--label`. No `gh` or no network? Still write the full PR body,
   and hand it back with the compare URL instead of blocking.

## Write rules (always)

Card writes are frontmatter only — never rewrite prose. The one exception is `--finish`
ticking the card's own Acceptance boxes. Bump `updated` on every frontmatter edit
(UTC `…Z`); set `created` and `updated` on anything you create.

## Hand back

The PR link, the branch, one line per Acceptance bullet with its proof, anything left
out of scope, and any unanswered question from step 2.
