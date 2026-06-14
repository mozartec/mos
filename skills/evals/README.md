# Skill evals

Each skill keeps its evals in `skills/<name>/evals/evals.json` (prompt, expected
output, assertions). They run against a **fixture vault** with deliberately foreign
vocabulary so any hardcoded mos-repo vocabulary fails loudly. Evals never reference
this repo's live board: live cards move and the evals would rot.

- [`fixture-vault/`](fixture-vault/) — the **pick/ship** fixture (epic/job,
  Queued/Doing/Shipped, Now/Soon/Later). Used by `next-card` and `ship-card`.
- [`refine-fixture-vault/`](refine-fixture-vault/) — the **refinement** fixture
  (track/leg/errand, Sketch/Lined Up/Underway/Landed, Hot/Warm/Cool). It has a hub
  area (`registry` → one file) plus module areas, thin `Sketch` drafts that share the
  hub, an oversized split candidate, and a decided card to protect. Used by
  `refine-batch`. Kept separate so refinement scenarios don't disturb the pick/ship
  evals (a new ready card would change next-card's recommendation).

## Running an eval

1. Copy the fixture somewhere disposable and make it a repo:

   ```bash
   dest=$(mktemp -d)/vault
   cp -R skills/evals/fixture-vault "$dest"
   mkdir -p "$dest/.agents/skills"
   cp -R skills/next-card skills/ship-card "$dest/.agents/skills/"
   git -C "$dest" init -q -b main && git -C "$dest" add -A
   git -C "$dest" -c user.email=eval@local -c user.name=eval commit -qm "fixture"
   ```

2. Start a fresh agent (ideally a small model — the skills must hold up on weak
   models) with cwd=`$dest`, the skills "installed" at `.agents/skills/`, **no
   network**, and `gh` treated as unavailable. Give it the eval's `prompt`.

   (For `refine-batch`, copy `refine-fixture-vault` instead and install
   `skills/refine-batch`. Those evals reshape cards, so the agent needs to be told
   to apply changes — the prompts already say so.)

3. Judge the transcript against the eval's `assertions`. Special setups:
   - `not-a-vault-refusal` (both skills): run from an empty directory.
   - `harness-branch-stay` (ship-card): before the run, `git switch -c copilot/do-jb-102`.
   - `parallel-batch-no-areas` (next-card): delete the top-level `areas` key from
     `.mos/config.json` (turns the vault back into an unscoped one).
   - `no-areas-degrade` (refine-batch): same — delete the top-level `areas` key from
     the refine fixture's `.mos/config.json` before the run.

## Fixture map

The vault declares three non-overlapping **areas** (`prose` → `docs/**`, `layout`
→ `assets/**`, `data` → `data/**`); cards declare which they `touches`. The
in-flight column (for overlap checks) is `Doing` — the one before the last.

| Card | Purpose | `touches` |
|---|---|---|
| EP-100 (Rolling) | container epic — children JB-101 (Shipped), JB-102 (open) | layout |
| EP-106 (New → Queued, Soon) | standalone leaf epic; well-formed; ready pick disjoint from JB-102; `data` collides with in-flight JB-103 | data |
| JB-101 (Shipped) | done child; satisfies JB-102's dependency | prose |
| JB-102 (Queued, Now) | the ready, well-formed pick; trivial scoped work | prose |
| JB-103 (Blocked, Soon) | blocked status + unmet dependency JB-104; in-flight (Doing) | data |
| JB-104 (Queued, Soon) | ready but thin — no `## Acceptance`; collides with JB-102 (prose) and EP-106 (data) | prose, data |
| EP-105 (Icebox) | hidden status (maps to no column) | — |

## Refine fixture map

[`refine-fixture-vault/`](refine-fixture-vault/) declares a **hub** area (`registry`
→ the single file `app/registry.ts`) and **module** areas (`flights`, `hotels`,
`cars`, plus `guide` for prose). Initial state per type is `Sketch`; anything past it
is decided (frontmatter-only). The split-capable type is `track` (children are `leg`s).

| Card | Purpose | `touches` |
|---|---|---|
| TR-200 (Sketch, Hot) | thin search draft; shares the `registry` hub with TR-201/202 | registry, flights |
| TR-201 (Sketch, Warm) | thin search draft; shares the hub | registry, hotels |
| TR-202 (Sketch, Warm) | thin search draft; shares the hub → the enabler-extraction cluster | registry, cars |
| TR-210 (Sketch, Hot) | oversized; spans the hub + all three modules → split into container + legs | registry, flights, hotels, cars |
| TR-220 (Underway, Warm) | decided card on a shared surface (`registry`) — prose must stay untouched | registry, guide |
| ER-300 (Sketch, Cool) | disjoint module work (prose only); not part of any cluster | guide |
