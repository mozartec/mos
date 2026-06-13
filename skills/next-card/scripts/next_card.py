#!/usr/bin/env python3
"""next_card.py — rank the actionable cards in a mos vault and recommend what to do next.

Zero dependencies. Run with Python 3:
    python3 next_card.py [<vaultDir>] [--sprint S1] [--json]
    python3 next_card.py [<vaultDir>] --parallel [N]   # a conflict-free batch of
                                                       # up to N ready cards (ADR-021)

A "vault" is any directory containing .mos/config.json. With no path, the script
discovers the nearest vault at or above the current directory; without one it refuses
to run. It is config-driven: columns, types, states, sprints, and the priority scale
all come from .mos/config.json, so it works on any mos vault.

What it does, mirroring how a maintainer eyeballs the board:
  - reads the config to learn columns (left→right = progress), each type's
    state→column map, the sprint order, and the priority values;
  - parses every board card's frontmatter, and scrapes "Depends on:" ids from the body;
  - classifies each card as done / hidden / blocked / ready;
  - ranks the ready cards and prints the top recommendation plus a shortlist.

It does NOT pick "container" cards (ones that have children): it recommends the
concrete leaf to execute. Shipping a whole container is a deliberate human choice —
use the ship-card skill directly with the container's id for that.
"""
import json, os, re, sys
from pathlib import Path

IGNORE = {"node_modules", ".git", ".angular", ".turbo", "dist", ".cache"}


def find_vault(start: Path):
    cur = start.resolve()
    for d in [cur, *cur.parents]:
        if (d / ".mos" / "config.json").is_file():
            return d
    return None


def glob_to_re(glob: str):
    re_str = re.sub(r"[.+^${}()|\[\]\\]", lambda m: "\\" + m.group(0), glob)
    re_str = (re_str.replace("**/", "\0").replace("**", "\1").replace("*", "[^/]*")
              .replace("?", ".").replace("\0", "(?:.*/)?").replace("\1", ".*"))
    return re.compile("^" + re_str + "$")


def unquote(v: str):
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    return v


def parse_frontmatter(text: str):
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", text)
    if not m:
        return {}, text
    obj = {}
    lines = re.split(r"\r?\n", m.group(1))
    i = 0
    while i < len(lines):
        mm = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", lines[i])
        if mm:
            v = mm.group(2).strip()
            if v == "":
                # A bare `key:` may introduce a block-style list (VAULT_SPEC §5a):
                #   key:
                #     - entry
                items = []
                while i + 1 < len(lines):
                    im = re.match(r"^\s*-\s*(.*)$", lines[i + 1])
                    if not im:
                        break
                    items.append(unquote(im.group(1).strip()))
                    i += 1
                obj[mm.group(1)] = items if items else v
            else:
                obj[mm.group(1)] = unquote(v)
        i += 1
    return obj, text[m.end():]


def parse_list(raw):
    """A frontmatter list value, deduped (insertion order kept): a block list
    (already a list from parse_frontmatter), an inline `[a, b]`, or a bare single
    value; None when absent, [] when declared empty. Mirrors the validator's
    parseList so a vault parses identically here and in `bun run validate`."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, list):
        values = raw
    else:
        inline = re.match(r"^\[(.*)\]$", raw)
        values = ([unquote(s.strip()) for s in inline.group(1).split(",")]
                  if inline else [raw])
    out = []
    for v in values:
        if v and v not in out:
            out.append(v)
    return out


def walk(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE]
        for fn in filenames:
            if fn.endswith(".md"):
                yield Path(dirpath) / fn


# ids like F-001, F-001-S-02, T-003, RB-005 — permissive default shape
ID_RE = re.compile(r"\b([A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*)\b")


def depends_on(body: str):
    """Pull ids from a 'Depends on:' line in the body, if present."""
    deps = []
    for line in body.split("\n"):
        if re.search(r"depends on", line, re.I):
            seg = re.split(r"blocks", line, flags=re.I)[0]
            deps += ID_RE.findall(seg)
    return [d for d in deps if d]


def priority_rank(cfg):
    """Rank by position in the config's priority enum; fall back to a P0..P3 scale."""
    values = (cfg.get("fields", {}).get("priority") or {}).get("values") or []
    if values:
        return {v: i for i, v in enumerate(values)}
    return {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def load(vault: Path):
    cfg = json.loads((vault / ".mos" / "config.json").read_text("utf-8"))
    columns = cfg["board"]["columns"]
    includes = [glob_to_re(g) for g in cfg["board"].get("include", [])]
    sprints = cfg.get("sprints", []) or []
    types = cfg["types"]
    areas = cfg.get("areas", {}) or {}  # vault-defined surfaces (ADR-021); {} => unscoped

    cards = {}
    touches = {}  # id -> declared area names (list, maybe []), or None when undeclared
    for f in walk(vault):
        rel = f.relative_to(vault).as_posix()
        if not any(rx.match(rel) for rx in includes):
            continue
        data, body = parse_frontmatter(f.read_text("utf-8"))
        t = types.get(data.get("type", ""))
        if not t or not data.get("id"):
            continue
        cid = data["id"]
        col = t["states"].get(data.get("status", ""))  # None => hidden or unknown status
        cards[cid] = {
            "id": cid, "title": data.get("title", ""), "type": data["type"],
            "status": data.get("status", ""), "priority": data.get("priority", ""),
            "sprint": data.get("sprint", ""), "parent": data.get("parent", ""),
            "column": col, "deps": depends_on(body),
            "ready_doc": "## Acceptance" in body,  # proxy for card-readiness
            "rel": rel,
        }
        # Kept out of the card dict so single-pick output stays byte-identical.
        touches[cid] = parse_list(data.get("touches"))
    return cfg, columns, sprints, cards, areas, touches


def classify(columns, cards):
    last = columns[-1] if columns else None
    has_children = {c["parent"] for c in cards.values() if c["parent"]}
    # A real dependency id starts with a prefix some card actually uses.
    known_prefixes = {cid.split("-")[0] for cid in cards}

    def done(c):
        return c["column"] == last

    for c in cards.values():
        deps = [d for d in c["deps"] if d.split("-")[0] in known_prefixes and d != c["id"]]
        c["deps"] = deps
        c["is_done"] = done(c)
        c["is_hidden"] = c["column"] is None
        c["is_container"] = c["id"] in has_children
        c["is_blocked_status"] = bool(re.search(r"blocked", c["status"], re.I))
        c["unmet_deps"] = [d for d in deps if d in cards and not done(cards[d])]
        c["missing_deps"] = [d for d in deps if d not in cards]
    return cards


def is_ready(c):
    return (not c["is_done"] and not c["is_hidden"] and not c["is_blocked_status"]
            and not c["unmet_deps"] and not c["is_container"])


def rank_key(columns, sprints, prio_rank):
    def key(c):
        idx = columns.index(c["column"]) if c["column"] in columns else 0
        started = 0 if (0 < idx < len(columns) - 1) else 1  # started work first
        prio = prio_rank.get(c["priority"], len(prio_rank) + 9)
        sp = sprints.index(c["sprint"]) if c["sprint"] in sprints else len(sprints)
        return (started, prio, sp, c["id"])
    return key


def parallel_batch(candidates, touches, areas, n):
    """Greedy, deterministic conflict-free batch (ADR-021). `candidates` are the
    ready cards already in pick order; `touches[id]` is a card's declared area
    names (possibly []), or None when undeclared. Visiting in rank order, a card
    joins the batch when its areas are disjoint from every member already in it;
    otherwise it's an excluded conflict (one entry per colliding pair, the area
    named). A card with no `touches` is set aside as undeclared — its surface is
    unknown, so parallel safety can't be claimed (an explicit `[]` declares
    "touches nothing" and batches). With no `areas` configured the vault plans no
    surfaces: the batch is simply the next n ready cards, overlap unknown."""
    if not areas:
        return {"no_areas": True, "batch": [c["id"] for c in candidates[:n]],
                "conflicts": [], "undeclared": [], "deferred": []}
    batch, claimed = [], {}  # claimed: batch member id -> its area names
    conflicts, undeclared, deferred = [], [], []
    for c in candidates:
        cid = c["id"]
        names = touches.get(cid)
        if names is None:
            undeclared.append(cid)
            continue
        clashed = False
        for member, member_names in claimed.items():
            shared = [a for a in names if a in member_names]
            if shared:
                conflicts.append({"excluded": cid, "with": member, "areas": shared})
                clashed = True
        if clashed:
            continue
        if len(batch) < n:
            batch.append(cid)
            claimed[cid] = names
        else:
            deferred.append(cid)  # disjoint, but the requested n is already full
    return {"no_areas": False, "batch": batch, "conflicts": conflicts,
            "undeclared": undeclared, "deferred": deferred}


def print_batch(name, n, result, cards, touches, diagnostics):
    print(f"\n=== Parallel batch in: {name} — up to {n} ===\n")
    if result["no_areas"]:
        print("  ⚠ This vault declares no `areas`, so file overlap can't be checked.")
        print("    These are just the next ready cards in rank order — confirm they")
        print("    don't collide before running them in parallel.\n")
        print("  Ready (overlap unknown):")
        for idx, cid in enumerate(result["batch"], 1):
            c = cards[cid]
            print(f"    {idx}. {c['id']:<12} {c['priority'] or '--'} {c['title']}  · [{c['column']}]")
        if not result["batch"]:
            print("    (nothing ready)")
        print()
        return

    print("  Batch — ready and touches-disjoint, in pick order:")
    if result["batch"]:
        for idx, cid in enumerate(result["batch"], 1):
            c = cards[cid]
            ts = touches.get(cid)
            ts_str = ", ".join(ts) if ts else "∅ touches nothing"
            print(f"    {idx}. {c['id']:<12} {c['priority'] or '--'} {c['title']}"
                  f"  · [{c['column']}] · touches: {ts_str}")
    else:
        print("    (nothing ready to batch)")

    if result["conflicts"]:
        by_excluded = {}
        for cf in result["conflicts"]:
            by_excluded.setdefault(cf["excluded"], []).append(cf)
        print("\n  Excluded — would collide with a batch member:")
        for cid, cfs in by_excluded.items():
            parts = "; ".join(f"{cf['with']} on {', '.join(cf['areas'])}" for cf in cfs)
            print(f"    {cid:<12} conflicts with {parts}")

    if result["undeclared"]:
        print("\n  Undeclared surface (no `touches` — parallel safety unknown):")
        for cid in result["undeclared"]:
            print(f"    {cid:<12} {cards[cid]['title']}")

    if result["deferred"]:
        print(f"\n  Also ready & disjoint, beyond the requested {n} (raise --parallel):")
        for cid in result["deferred"]:
            print(f"    {cid:<12} {cards[cid]['title']}")

    if diagnostics:
        print("\n  Diagnostics (surfaced, not swallowed — ADR-021):")
        for d in diagnostics:
            print(f"    - {d}")
    print()


def main():
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    sprint_filter = None
    if "--sprint" in args:
        i = args.index("--sprint")
        sprint_filter = args[i + 1]
        del args[i:i + 2]
    parallel_n = None
    if "--parallel" in args:
        i = args.index("--parallel")
        n = 3  # an optional count may follow; default to a 3-card batch
        if i + 1 < len(args) and re.fullmatch(r"\d+", args[i + 1]):
            n = int(args[i + 1])
            del args[i:i + 2]
        else:
            del args[i:i + 1]
        parallel_n = max(1, n)
    start = Path(args[0]) if args else Path.cwd()

    vault = find_vault(start)
    if not vault:
        print(f"Not a mos vault: no .mos/config.json found at or above '{start}'. "
              "This skill requires one — refusing to start.", file=sys.stderr)
        sys.exit(2)

    cfg, columns, sprints, cards, areas, touches = load(vault)
    classify(columns, cards)
    prio_rank = priority_rank(cfg)

    pool = list(cards.values())
    if sprint_filter:
        pool = [c for c in pool if c["sprint"] == sprint_filter]

    ready = sorted([c for c in pool if is_ready(c)], key=rank_key(columns, sprints, prio_rank))
    blocked = [c for c in pool if c["is_blocked_status"] or c["unmet_deps"] or c["missing_deps"]]
    name = cfg.get("vault", {}).get("name", str(vault))

    if parallel_n is not None:
        result = parallel_batch(ready, touches, areas, parallel_n)
        # Unresolved dependency ids drop their edge (they don't block readiness)
        # but must be surfaced, not swallowed (ADR-021).
        diagnostics = [
            f"{c['id']}: unresolved dependency {', '.join(c['missing_deps'])} "
            "(edge dropped — does not block readiness)"
            for c in ready if c["missing_deps"]
        ]
        if as_json:
            print(json.dumps({
                "vault": name, "parallel": parallel_n, "areasDeclared": bool(areas),
                "batch": result["batch"], "conflicts": result["conflicts"],
                "undeclared": result["undeclared"], "deferred": result["deferred"],
                "diagnostics": diagnostics,
            }, indent=2))
        else:
            print_batch(name, parallel_n, result, cards, touches, diagnostics)
        return

    if as_json:
        out = {"vault": cfg.get("vault", {}).get("name", str(vault)),
               "recommendation": ready[0] if ready else None,
               "shortlist": ready[1:4], "blocked": blocked}
        print(json.dumps(out, indent=2))
        return

    print(f"\n=== Next in: {name} ===\n")
    if not ready:
        print("  Nothing is ready to start. Check the blocked/waiting list below.")
    else:
        top = ready[0]
        flag = "  ⚠ card body has no ## Acceptance — may not be ready to execute" if not top["ready_doc"] else ""
        print(f"  → RECOMMENDED: {top['id']}  {top['title']}")
        print(f"      {top['type']} · {top['priority'] or '--'} · {top['status']}"
              f" · sprint {top['sprint'] or '—'} · column [{top['column']}]")
        print(f"      file: {top['rel']}{flag}")
        if len(ready) > 1:
            print("\n  Shortlist (next ready):")
            for c in ready[1:4]:
                print(f"    {c['id']:<12} {c['priority'] or '--'} {c['title']}"
                      f"  · sprint {c['sprint'] or '—'} · [{c['column']}]")
    if blocked:
        print("\n  Blocked / waiting (not actionable yet):")
        for c in sorted(blocked, key=lambda x: x["id"]):
            why = ("status " + c["status"]) if c["is_blocked_status"] else ""
            if c["unmet_deps"]:
                why = (why + " " if why else "") + "waiting on " + ", ".join(c["unmet_deps"])
            if c["missing_deps"]:
                why = (why + " " if why else "") + "missing dep " + ", ".join(c["missing_deps"])
            print(f"    {c['id']:<12} {c['title']}  · {why}")
    print()


if __name__ == "__main__":
    main()
