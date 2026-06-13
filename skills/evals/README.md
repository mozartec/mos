# Skill evals

Each skill keeps its evals in `skills/<name>/evals/evals.json` (prompt, expected
output, assertions). They run against the shared **fixture vault** in
[`fixture-vault/`](fixture-vault/) — a deliberately foreign vocabulary (epic/job,
Queued/Doing/Shipped, Now/Soon/Later priorities) so any hardcoded mos-repo
vocabulary fails loudly. Evals never reference this repo's live board: live cards
move and the evals would rot.

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

3. Judge the transcript against the eval's `assertions`. Special setups:
   - `not-a-vault-refusal`: run from an empty directory instead of the fixture.
   - `harness-branch-stay`: before the run, `git switch -c copilot/do-jb-102`.
   - `parallel-batch-no-areas`: before the run, delete the top-level `areas` key
     from `.mos/config.json` (turns the vault back into an unscoped one).

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
