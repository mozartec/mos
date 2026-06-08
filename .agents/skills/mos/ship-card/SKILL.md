---
name: mos-ship-card
description: >
  Take one already-chosen mos board card from its id to an open pull request — plan, raise
  doubts, branch, build, commit, push, open the PR. Use it whenever the user names a specific
  card and wants it shipped end-to-end, however phrased: "/mos-ship-card F-002-S-01", "ship
  F-004-S-01", "start T-006 and open a PR", "finish T-003", or a bare card id like "F-004-S-01"
  when the intent is to build and ship it. Trigger it in any repo with a `.mos/config.json` even
  if the user never says "mos" — if they point at a board card and want it done, prefer this
  skill over ad-hoc handling, to keep branch/commit/pause-on-doubt discipline consistent. It
  plans first and stops to ask when anything is unclear, risky, or contradictory rather than
  guessing. It's the known-card counterpart to mos-next-task, which *chooses* what's next: use
  next-task for "what should I work on", ship-card once the card is picked. Don't use it to
  create/edit card contents, review a PR, report board status, or answer card questions with no
  ship intent.
metadata:
  version: 0.1.0
---

# mos — ship a card

You've been given a card id. Your job is to take that one card all the way to an open pull
request: understand it, plan it, surface anything that doesn't add up, and — only when the
path is clear — branch, build, commit, push, and open the PR.

A **mos vault** is a folder of markdown where `board/*.md` files are cards and
`.mos/config.json` defines the card types, their states, the board columns, and the sprints.
The folder is the source of truth; the app only reads it; agents do the writing by following
the vault's `AGENTS.md`. Everything here is **config-driven** — never hardcode `F-`/`T-`,
column names, type labels, or states; read them from `.mos/config.json` (the bundled script
does this for you).

The single most important rule, and the reason this skill exists: **plan and ask before you
build.** A wrong assumption costs more than a question. The vault's own `AGENTS.md` says it
plainly — "When in doubt, ask — don't assume." So this skill front-loads a planning-and-doubt
pass and genuinely stops for the human when something is off, instead of papering over it.

## The flow at a glance

1. **Pre-flight** — run the script, read the card and what it links.
2. **Plan & doubt-check** — write a short plan; if anything is unclear, risky, or
   contradictory, **stop and ask the human.** Do not proceed on a guess.
3. **Branch** — once clear, create `<label>/<id>-<slug>` and mark the card In Progress.
4. **Build** — do only what the card scopes, honoring the vault's constraints.
5. **Commit, push, PR** — Conventional Commits, fold the card's move to Done into the final
   commit, push the branch, and open the PR.

Steps 1–2 are where the value is. Don't rush them to get to the git part.

## Step 1 — pre-flight

Run the bundled script first, so you plan from facts rather than a half-remembered board. It
locates the card, computes the branch name from the vault's own type labels, resolves the
card's dependencies, and flags soft spots (unmet deps, a container card, a thin body):

```bash
# in this repo:
python3 .agents/skills/mos/ship-card/scripts/ship_card.py <card-id>
# anywhere (resilient to where the skill was installed; skips node_modules/.git):
python3 "$(find . -type d \( -name node_modules -o -name .git \) -prune -o \
  -path '*ship-card/scripts/ship_card.py' -print | head -1)" <card-id>
# add --json for machine-readable output
```

Then open the card file it points to and **read it fully**, plus the docs/ADRs it links under
"Context — read before starting." A well-formed mos card is self-sufficient by design: Outcome,
Context, Constraints, Plan, Acceptance, Dependencies, Out of scope. Read the nearest
`AGENTS.md` too (root, and any closer one) — it carries the vault's non-negotiable constraints,
which the card assumes you've internalized.

## Step 2 — plan, and raise doubts before building

Write a brief plan in your own words: what you'll change, which files, and how you'll know it's
done (the card's Acceptance is your checklist). This is also your honesty checkpoint. **Pause
and ask the human — don't decide for them — if any of these are true:**

- **The card is underspecified.** No `## Acceptance`, vague outcome, or a "Plan" that hand-waves
  the hard part. Per the vault's readiness standard, a card a cold agent can't execute from
  isn't ready — say what's missing and offer to enrich it first, rather than inventing the
  details.
- **A dependency isn't met.** The script flags a `Depends on:` id that isn't in the last column.
  Building on an unfinished dependency is usually wrong; confirm the human wants to proceed (or
  redirect to the dependency).
- **It's the wrong kind of card.** A container feature (has child stories) or a card whose
  status maps to no column (Deferred/Dropped). You ship a concrete story/task, not an umbrella.
- **You found a contradiction or a flaw.** The card conflicts with a doc or ADR, asks you to
  violate a constraint (e.g. write to the vault when the app must stay read-only, or put
  framework code in a pure core), or the approach simply doesn't make sense given what the code
  actually looks like.
- **The scope is ambiguous or larger than it reads.** "Out of scope" is unclear, or doing the
  Outcome honestly means touching things the card doesn't mention.
- **There's real risk.** Schema/format changes, anything destructive, public-API or
  vault-format breaks, security-sensitive paths.

When you pause, be specific and brief: name the concern, show the relevant line, and propose the
options you see. One round of good questions beats ten minutes of confident wrong work. If
nothing trips these wires, say so in a sentence and move on — don't manufacture doubt to look
careful.

> **You do not make product or scope decisions on the user's behalf.** Resolving a genuine
> ambiguity, choosing between real alternatives, cutting or expanding scope, and accepting a
> risk are all the human's calls. Surface them; let the human decide.

## Step 3 — branch and mark In Progress

Once the human has cleared any doubts (or there were none), create the branch. The name comes
from the card's **type label** (lower-cased) and **id**, with a short kebab-case description —
the script prints the exact string:

```
<label>/<id>-<short-description>
```

**Examples** (labels come from `config.types.<type>.label`, lower-cased, so they match whatever
the vault defines):

- story `F-004-S-01` "Render columns from config" → `story/F-004-S-01-render-columns`
- task `T-006` "Icons and fonts" → `task/T-006-icons-and-fonts`
- feature-level work → `feature/<id>-<slug>`

The id keeps its own casing (it's the card's identifier); only the type prefix is lower-cased.
Create the branch from an up-to-date base (typically `main`):

```bash
git switch main && git pull --ff-only
git switch -c "story/F-004-S-01-render-columns"
```

**Worktrees:** this setup runs with worktrees on by default, so you may already be in a fresh
worktree for this card — in that case just create/checkout the branch there; don't try to
re-clone or fight the worktree the harness gave you.

Then mark the card **In Progress**. The board app never writes cards — that's the agent's job —
so follow the vault's write rules from `AGENTS.md`: **edit frontmatter only, never rewrite the
prose body**, set `status` to the type's In-Progress state, and bump the `updated` timestamp to
now (ISO 8601 UTC). Commit that as its own small `docs`/`chore` commit or fold it into your
first commit — your call.

## Step 4 — build

Do **only what the card scopes** — its Plan and Outcome define the work; its "Out of scope" is
where cold agents overreach, so respect it. Honor the vault's non-negotiable constraints from
`AGENTS.md` (in this repo: pure core, read-only app, config-driven, folder is source of truth).
Check the card's Acceptance list as you go; it's the definition of done.

**Edit only the card you're shipping.** Don't change another card's status or body — even one
that looks stale or "already done." Whether a *different* card is finished is a separate call for
the human; touching sibling cards is a common overreach, so resist it.

**Iterate with the cheap check, not the expensive one.** While writing code, run only the fast,
*scoped* unit tests for the package you're touching — `bunx turbo run test --filter=<package>`
(`--filter=@mos/core` for core work). Do **not** re-run the full repo build or any
security/CodeQL/review pass after every edit: they're slow and verbose, and their output piles up
until it crowds your own context out (a real failure mode — it can blow the session's size
limit). Save the full suite for the end (Step 5).

**Know when to stop.** When the scoped tests are green and every `## Acceptance` bullet is
genuinely satisfied, you're **done** — go to Step 5. Don't gold-plate, don't chase nits, and
don't try to make a green-but-noisy full build "greener." Pre-existing warnings or failures in
packages your card never touched are **out of scope**: note them in your close-out, don't fix
them.

## Step 5 — commit, push, open the PR

Commit with **Conventional Commits** — the format this project uses (see the releasing doc the
repo links). Shape:

```
<type>(<optional scope>): <summary>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`; breaking
changes use `!` or a `BREAKING CHANGE:` footer. Let the **card's type** guide you: a story under
a feature is usually a `feat`; a task is often `chore`/`ci`/`build`/`refactor` depending on what
it touches. Use a scope that names the area (e.g. `feat(board): …`). Keep commits coherent.

**Example:**
Input: a story that groups board cards into columns by their type→state map
Output: `feat(board): group cards into columns by type state map`

**Mark the card Done as part of your final commit.** Before that last commit, run the project's
full checks **once** so you don't open a red PR — in this repo that's
`bun run lint && bun run test && bun run build && bun run validate` (the last keeps the board
valid, since this repo is also a vault). This whole-repo pass is the slow one, so run it at the
end, not in a loop; if it surfaces a failure in a package your card never touched, that's
pre-existing — say so and leave it. Once your scoped work passes, set the card's `status` to Done (frontmatter only, bump `updated`) and
include that edit **in the last commit on the branch** — not a separate trailing commit. So if
the work is one commit, the Done edit rides along in it; if it's several, the Done edit goes into
the final one. That keeps the branch's tip commit the moment the card is truly finished, and
keeps the squash-merge clean. Then push and open the PR:

```bash
git add -A && git commit -m "feat(board): render columns from config"   # final commit also marks the card Done
git push -u origin HEAD
gh pr create --base main \
  --title "feat(board): render columns from config" \
  --body "Closes F-004-S-01.

<one-paragraph summary of what changed>

## Acceptance
- [x] <acceptance bullet 1> — <the check that proves it>
- [x] <acceptance bullet 2> — <the check that proves it>"
```

Make the **PR title a Conventional Commit** — PRs squash-merge here, so that one line becomes the
commit on `main` and is what release tooling reads. In the body, reference the card id and map
your work to its Acceptance bullets so review is a quick check. If `gh` isn't available, push the
branch and give the user the compare URL (`https://github.com/<owner>/<repo>/compare/<branch>?expand=1`)
to open it manually — don't block.

Then tell the user the PR link, the branch, and a one-line summary of what shipped and how it
meets acceptance.

> **A note on the Done timing:** Done is folded into the **last commit** on the branch (the work's
> completion), and the PR is opened from there. If you'd rather Done mean "merged," leave the card
> In Progress at PR time and say so — but the default is Done-on-the-final-commit.

## Before you open the PR — check the boxes

The finish line. Verify each item is *genuinely* true — don't just assert it. Put the card's
Acceptance as a **ticked list in the PR body** (above): the card's own prose body is read-only,
so never tick its boxes there (ADR-002) — the PR is where you record that they're met.

- [ ] **Every `## Acceptance` bullet is satisfied,** and each maps to a check you actually ran —
      a test, a command, an observed output — not a hopeful "should work."
- [ ] **Scoped checks are green:** `bunx turbo run lint test --filter=<package>`.
- [ ] **Full suite run once and green:** `bun run lint && bun run test && bun run build &&
      bun run validate`. Any red is in code your card touched — pre-existing failures elsewhere
      are noted, not chased.
- [ ] **Scope held:** you changed only what the card scopes, and only the card you're shipping
      changed state (to Done, in the final commit, frontmatter-only, `updated` bumped).
- [ ] **No open question from Step 2** — anything you raised, the human answered.

If a box can't be honestly checked, **don't open the PR**: finish the work, or stop and tell the
human exactly which box is failing and why.

## What you hand back

A short close-out: the PR link, the branch name, the finish-line boxes you checked (and how each
Acceptance bullet was proven), and anything you deliberately left out of scope. If you paused for
the human at step 2 and they haven't answered, stop there — an open question is a fine place to
end a turn.

## Example

**Input:** "/mos-ship-card F-004-S-01"
**Output:** runs the script (branch would be `story/F-004-S-01-render-columns`, no unmet deps,
has Acceptance), reads the card + the docs it links, writes a 4-line plan, notes "no open
questions — the card is well-scoped and its deps are Done," then on the user's go-ahead: branches,
sets the card In Progress, implements column layout per the Plan, runs lint/test/build/validate,
folds the card's move to Done into its final commit `feat(board): render columns from config`,
pushes, and opens the PR closing F-004-S-01 — returning the PR link and the satisfied acceptance
bullets.

**Input:** "/mos-ship-card F-005-S-01"
**Output:** runs the script, sees the card is `Blocked` and waits on T-004/T-002, and **stops**:
"F-005-S-01 depends on T-004 and T-002, neither of which is Done, and its own status is Blocked.
I don't think this is ready to ship — do you want me to work a blocker first (T-002?), or proceed
anyway?" — no branch, no code, until the human decides.
