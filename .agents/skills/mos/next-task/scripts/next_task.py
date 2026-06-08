#!/usr/bin/env python3
"""next_task.py — rank the actionable cards in a mos vault and recommend what to do next.

Zero dependencies. Run with Python 3:
    python3 next_task.py [<vaultDir>] [--sprint S1] [--json]

A "vault" is any directory containing .mos/config.json. With no path, the script
discovers the nearest vault at or above the current directory. It is config-driven:
columns, types, states, and sprints all come from .mos/config.json, so it works on
any mos vault, not just this one.

What it does, mirroring how a maintainer eyeballs the board:
  - reads the config to learn columns (left→right = progress), each type's
    state→column map, and the sprint order;
  - parses every board card's frontmatter, and scrapes "Depends on:" ids from the body;
  - classifies each card as done / hidden / blocked / not-ready / ready;
  - ranks the ready cards and prints the top recommendation plus a shortlist.

It deliberately does NOT pick "container" features (cards that have child cards):
you execute the concrete story or task, not the umbrella feature.
"""
import json, os, re, sys
from pathlib import Path

IGNORE = {"node_modules", ".git", ".angular", ".turbo", "dist", ".cache"}
PRIORITY_RANK = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


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


def parse_frontmatter(text: str):
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", text)
    if not m:
        return {}, text[m.end():] if m else text
    obj = {}
    for line in m.group(1).split("\n"):
        mm = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if not mm:
            continue
        v = mm.group(2).strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        obj[mm.group(1)] = v
    return obj, text[m.end():]


def walk(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE]
        for fn in filenames:
            if fn.endswith(".md"):
                yield Path(dirpath) / fn


# ids like F-001, F-001-S-02, T-003, RB-005 — configurable shape, default permissive
ID_RE = re.compile(r"\b([A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*)\b")


def depends_on(body: str):
    """Pull ids from a 'Depends on:' line in the body, if present."""
    deps = []
    for line in body.split("\n"):
        if re.search(r"depends on", line, re.I):
            # only take ids before a 'Blocks' clause on the same line
            seg = re.split(r"blocks", line, flags=re.I)[0]
            deps += ID_RE.findall(seg)
    return [d for d in deps if d]


def load(vault: Path):
    cfg = json.loads((vault / ".mos" / "config.json").read_text("utf-8"))
    columns = cfg["board"]["columns"]
    includes = [glob_to_re(g) for g in cfg["board"].get("include", [])]
    sprints = cfg.get("sprints", []) or []
    types = cfg["types"]

    cards = {}
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
    return cfg, columns, sprints, cards


def classify(columns, cards):
    last = columns[-1] if columns else None
    has_children = set()
    for c in cards.values():
        if c["parent"]:
            has_children.add(c["parent"])

    # A real dependency id starts with a prefix some card actually uses (F, T, RB…).
    # This disambiguates true ids (F-002) from prose fragments like "S-02/S-03" that
    # share the id shape but aren't cards.
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


def rank_key(columns, sprints):
    def key(c):
        idx = columns.index(c["column"]) if c["column"] in columns else 0
        started = 0 if (0 < idx < len(columns) - 1) else 1  # started work first
        prio = PRIORITY_RANK.get(c["priority"], 9)
        sp = sprints.index(c["sprint"]) if c["sprint"] in sprints else len(sprints)
        return (started, prio, sp, c["id"])
    return key


def main():
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    sprint_filter = None
    if "--sprint" in args:
        i = args.index("--sprint")
        sprint_filter = args[i + 1]
        del args[i:i + 2]
    start = Path(args[0]) if args else Path.cwd()

    vault = find_vault(start)
    if not vault:
        print("No mos vault found (no .mos/config.json at or above the path).", file=sys.stderr)
        sys.exit(2)

    cfg, columns, sprints, cards = load(vault)
    classify(columns, cards)

    pool = list(cards.values())
    if sprint_filter:
        pool = [c for c in pool if c["sprint"] == sprint_filter]

    ready = sorted([c for c in pool if is_ready(c)], key=rank_key(columns, sprints))
    blocked = [c for c in pool if c["is_blocked_status"] or c["unmet_deps"] or c["missing_deps"]]
    not_ready_doc = [c for c in ready if not c["ready_doc"]]

    if as_json:
        out = {"vault": cfg.get("vault", {}).get("name", str(vault)),
               "recommendation": ready[0] if ready else None,
               "shortlist": ready[1:4], "blocked": blocked}
        print(json.dumps(out, indent=2))
        return

    name = cfg.get("vault", {}).get("name", str(vault))
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
