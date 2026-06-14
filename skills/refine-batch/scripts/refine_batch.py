#!/usr/bin/env python3
"""refine_batch.py — survey a mos backlog for refinement (ADR-022).

Zero dependencies. Run with Python 3:
    python3 refine_batch.py [<vaultDir>] [--phase P] [--limit N] [--json]

A "vault" is any directory containing .mos/config.json. With no path, the script
discovers the nearest vault at or above the current directory; without one it refuses
to run. It is config-driven: columns, types, states, areas, and the priority scale all
come from .mos/config.json, so it works on any mos vault.

This script is the *read-only pre-compute* for the refine-batch skill — it never edits
a card. It front-loads the mechanical work so the agent spends its judgment on shaping,
not parsing:

  - finds each type's INITIAL state (the first state the type declares in config). Per
    ADR-022, refinement may rewrite prose / split / add enabler cards ONLY for cards
    still in that initial state; everything else is frontmatter-only (ADR-002). This is
    the boundary, computed mechanically so any agent applies it identically.
  - over an explicit horizon (default: the whole backlog; --phase / --limit narrow it),
    classifies every card and reports, per refinable card:
      * Pass 1 (readiness) — which cold-start sections (09-CONVENTIONS §Card readiness)
        the body is missing;
      * Pass 2 (surfaces)  — whether `touches` is declared, empty, or missing;
      * Pass 3 (shape)     — the overlap CLUSTERS: areas declared by two or more
        refinable cards. Those clusters are exactly the cards a refinement pass should
        reshape into a sequenced enabler plus disjoint leaves, instead of a serialized
        pick order. An area declared by many cards is flagged as a possible hub for the
        agent to confirm with the forced-file test + git co-occurrence (VAULT_SPEC §5c).

  With no `areas` configured the vault plans no surfaces: passes 1-2 still run and pass 3
  reports that overlap is UNKNOWN rather than guessing (the honest degrade).

Cards beyond their initial state are listed separately as frontmatter-only, so the agent
never rewrites a decided card's prose — even one that shares a surface with the cluster.
"""
import json, os, re, sys
from pathlib import Path

IGNORE = {"node_modules", ".git", ".angular", ".turbo", "dist", ".cache"}

# The cold-start sections a ready card carries (09-CONVENTIONS §Card readiness). A tiny
# card may legitimately skip some; the agent decides — the script only reports the gaps.
READY_SECTIONS = ["Outcome", "Context", "Constraints", "Plan", "Acceptance", "Out of scope"]


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
                # A bare `key:` may introduce a block-style list (VAULT_SPEC §5a).
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
    """A frontmatter list value, deduped (insertion order kept): None when absent, []
    when declared empty. Mirrors the validator's parseList and next_card.py."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, list):
        values = raw
    else:
        inline = re.match(r"^\[(.*)\]$", raw)
        values = ([s for s in (unquote(x.strip()) for x in inline.group(1).split(","))
                   if s]
                  if inline else [raw])
    out = []
    for v in values:
        if v not in out:
            out.append(v)
    return out


def walk(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE]
        for fn in filenames:
            if fn.endswith(".md"):
                yield Path(dirpath) / fn


ID_RE = re.compile(r"\b([A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*)\b")


def depends_on(body: str):
    deps = []
    for line in body.split("\n"):
        if re.search(r"depends on", line, re.I):
            seg = re.split(r"blocks", line, flags=re.I)[0]
            deps += ID_RE.findall(seg)
    return [d for d in deps if d]


def missing_sections(body: str):
    return [s for s in READY_SECTIONS if f"## {s}" not in body]


def initial_state(type_def):
    """A type's initial state = the FIRST state it declares (ADR-022). json preserves
    insertion order, so the first key of the states map is it."""
    states = type_def.get("states", {})
    return next(iter(states), None)


def load(vault: Path):
    cfg = json.loads((vault / ".mos" / "config.json").read_text("utf-8"))
    columns = cfg["board"]["columns"]
    includes = [glob_to_re(g) for g in cfg["board"].get("include", [])]
    types = cfg["types"]
    areas = cfg.get("areas", {}) or {}
    prio_values = (cfg.get("fields", {}).get("priority") or {}).get("values") or []
    prio_rank = {v: i for i, v in enumerate(prio_values)} if prio_values else \
                {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

    # Types that can be a CONTAINER: some other type names them as its `parent`. Only a
    # card of such a type can be split into a container + child cards (ADR-019); a leaf
    # type (no child type points at it) is split into siblings or an enabler instead.
    parent_types = {t.get("parent") for t in types.values() if t.get("parent")}

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
        init = initial_state(t)
        status = data.get("status", "")
        cards[cid] = {
            "id": cid, "title": data.get("title", ""), "type": data["type"],
            "status": status, "priority": data.get("priority", ""),
            "phase": data.get("phase", ""), "parent": data.get("parent", ""),
            "column": t["states"].get(status),  # None => hidden / unknown status
            "is_initial": status == init,       # refinable iff in its type's initial state
            "allows_children": data["type"] in parent_types,
            "missing": missing_sections(body),
            "touches": parse_list(data.get("touches")),  # list / [] / None
            "deps": depends_on(body),
            "rel": rel,
        }
    return cfg, columns, types, areas, prio_rank, cards


def overlap_clusters(refinable):
    """Map area name -> the refinable cards declaring it, for areas shared by >= 2 cards.
    Those are the clusters that should become an enabler + disjoint leaves, not a queue.
    Cards with no `touches` can't be placed and are returned separately."""
    by_area = {}
    undeclared = []
    for c in refinable:
        names = c["touches"]
        if names is None:
            undeclared.append(c["id"])
            continue
        for a in names:
            by_area.setdefault(a, []).append(c["id"])
    clusters = {a: ids for a, ids in by_area.items() if len(ids) >= 2}
    return clusters, undeclared


def main():
    args = list(sys.argv[1:])
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    phase = None
    if "--phase" in args:
        i = args.index("--phase"); phase = args[i + 1]; del args[i:i + 2]
    limit = None
    if "--limit" in args:
        i = args.index("--limit"); limit = int(args[i + 1]); del args[i:i + 2]
    start = Path(args[0]) if args else Path.cwd()

    vault = find_vault(start)
    if not vault:
        print(f"Not a mos vault: no .mos/config.json found at or above '{start}'. "
              "This skill requires one — refusing to start.", file=sys.stderr)
        sys.exit(2)

    cfg, columns, types, areas, prio_rank, cards = load(vault)
    name = cfg.get("vault", {}).get("name", str(vault))
    last = columns[-1] if columns else None
    inits = {tn: initial_state(td) for tn, td in types.items()}

    # Horizon: refinable = in its type's initial state; narrow by phase/limit if asked.
    refinable = [c for c in cards.values() if c["is_initial"]]
    if phase:
        refinable = [c for c in refinable if c["phase"] == phase]
    refinable.sort(key=lambda c: (prio_rank.get(c["priority"], len(prio_rank) + 9), c["id"]))
    if limit is not None:
        refinable = refinable[:max(0, limit)]
    horizon_ids = {c["id"] for c in refinable}

    # Decided cards sharing the horizon's surfaces — frontmatter-only, never reshaped,
    # but worth naming so the agent sequences around them.
    horizon_areas = {a for c in refinable if c["touches"] for a in c["touches"]}
    decided_on_surface = sorted(
        c["id"] for c in cards.values()
        if c["id"] not in horizon_ids and not c["is_initial"]
        and c["column"] != last and c["touches"] and (set(c["touches"]) & horizon_areas)
    )

    clusters, undeclared = overlap_clusters(refinable) if areas else ({}, [])

    if as_json:
        print(json.dumps({
            "vault": name, "areasDeclared": bool(areas),
            "initialStates": inits,
            "refinable": [
                {"id": c["id"], "type": c["type"], "priority": c["priority"],
                 "phase": c["phase"], "title": c["title"], "allowsChildren": c["allows_children"],
                 "missingSections": c["missing"], "touches": c["touches"], "rel": c["rel"]}
                for c in refinable
            ],
            "overlapClusters": clusters,
            "undeclaredSurface": undeclared,
            "decidedOnSharedSurface": decided_on_surface,
        }, indent=2))
        return

    print(f"\n=== Refine backlog in: {name} ===\n")
    print("  Refinable = card in its type's INITIAL state (ADR-022 — prose may be")
    print("  reshaped). Initial states: " +
          ", ".join(f"{t}:{s}" for t, s in inits.items()) + "\n")

    if not refinable:
        print("  Nothing in an initial state in this horizon — no cards to refine.\n")
    for c in refinable:
        flags = " · type allows children (split → container)" if c["allows_children"] else ""
        print(f"  {c['id']:<12} {c['priority'] or '--':<3} {c['title']}{flags}")
        miss = ", ".join(c["missing"]) if c["missing"] else "none"
        print(f"      readiness gaps: {miss}")
        ts = ("∅ (touches nothing)" if c["touches"] == []
              else ", ".join(c["touches"]) if c["touches"] else "— MISSING (surface unknown)")
        print(f"      touches: {ts}")
        print(f"      file: {c['rel']}")

    print("\n  --- Pass 3: shape (surface overlap) ---")
    if not areas:
        print("  ⚠ This vault declares no `areas`, so overlap is UNKNOWN. Passes 1-2")
        print("    above still apply; do not claim any cards are parallel-safe.\n")
        return
    if clusters:
        print("  Overlap clusters — reshape these into an enabler + disjoint leaves,")
        print("  not a serialized order. An area shared by many cards is a possible hub")
        print("  (confirm with the forced-file test + git co-occurrence, VAULT_SPEC §5c):")
        for a, ids in sorted(clusters.items(), key=lambda kv: (-len(kv[1]), kv[0])):
            hub = "  ← possible HUB" if len(ids) >= 3 else ""
            print(f"    {a:<10} shared by {', '.join(ids)}{hub}")
    else:
        print("  No refinable cards share a declared area — surfaces already disjoint.")
    if undeclared:
        print("\n  Undeclared surface (fill `touches` in pass 2 before shaping):")
        print("    " + ", ".join(undeclared))
    if decided_on_surface:
        print("\n  Decided cards on these surfaces (frontmatter-only — sequence around,")
        print("  never reshape their prose):")
        print("    " + ", ".join(decided_on_surface))
    print()


if __name__ == "__main__":
    main()
