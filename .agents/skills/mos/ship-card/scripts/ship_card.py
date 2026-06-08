#!/usr/bin/env python3
"""ship_card.py — pre-flight a single mos card before you start shipping it.

Zero dependencies. Run with Python 3:
    python3 ship_card.py <card-id> [<vaultDir>] [--json]

A "vault" is any directory containing .mos/config.json. With no vaultDir the script
discovers the nearest vault at or above the current directory. It is config-driven:
types, their human labels, states, and the column order all come from
.mos/config.json, so it works on any mos vault, not just this one.

Given a card id (e.g. F-004-S-01, T-003), it gathers the facts you need before
touching git, so you plan from data instead of guessing:

  - locates the card file and reads its frontmatter (type, title, status, parent);
  - computes the branch name from the vault's own type label + the file slug,
    e.g. story F-004-S-01-render-columns -> "Story/F-004-S-01-render-columns";
  - resolves the card's "Depends on:" ids and reports any that aren't Done yet
    (a card waiting on an unfinished dependency usually shouldn't be started);
  - checks the body for the readiness sections a cold agent needs (Acceptance,
    etc.) so a thin card gets flagged rather than silently half-built.

It does NOT make decisions. It prints what it found and where the soft spots are;
judging whether the card is truly ready — and pausing to ask the human when it
isn't — is the agent's job (see SKILL.md).
"""
import json, os, re, sys
from pathlib import Path

IGNORE = {"node_modules", ".git", ".angular", ".turbo", "dist", ".cache"}

# Body sections that signal a card is written to the "cold agent can execute it" bar.
# Acceptance is the floor; the others make a card comfortable rather than just possible.
READINESS_SECTIONS = ["Acceptance", "Outcome", "Context", "Constraints", "Plan"]

ID_RE = re.compile(r"\b([A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*)\b")


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
        return {}, text
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


def slugify(s: str):
    s = re.sub(r"[^A-Za-z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)


def depends_on(body: str):
    deps = []
    for line in body.split("\n"):
        if re.search(r"depends on", line, re.I):
            seg = re.split(r"blocks", line, flags=re.I)[0]
            deps += ID_RE.findall(seg)
    return deps


def load(vault: Path):
    cfg = json.loads((vault / ".mos" / "config.json").read_text("utf-8"))
    columns = cfg["board"]["columns"]
    includes = [glob_to_re(g) for g in cfg["board"].get("include", [])]
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
        cards[cid] = {
            "id": cid, "title": data.get("title", ""), "type": data["type"],
            "status": data.get("status", ""), "parent": data.get("parent", ""),
            "column": t["states"].get(data.get("status", "")),
            "label": t.get("label", data["type"].capitalize()),
            "deps": depends_on(body),
            "sections": [s for s in READINESS_SECTIONS if re.search(r"^#{1,6}\s.*" + s, body, re.M | re.I)],
            "path": f, "rel": rel, "stem": f.stem,
        }
    return cfg, columns, types, cards


def branch_name(card):
    """<label>/<id>-<slug>, label lower-cased. Prefer the file slug (already
    human-curated); fall back to the title. The id keeps it unique; the lower-cased
    label groups branches by work type the way `story/...`, `task/...`, `feature/...`
    read in `git branch`."""
    stem, cid = card["stem"], card["id"]
    slug = stem[len(cid) + 1:] if stem.startswith(cid + "-") else slugify(card["title"])
    return f"{card['label'].lower()}/{cid}-{slug}"


def main():
    args = sys.argv[1:]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    if not args:
        print("usage: ship_card.py <card-id> [<vaultDir>] [--json]", file=sys.stderr)
        sys.exit(2)

    card_id = args[0]
    start = Path(args[1]) if len(args) > 1 else Path.cwd()
    vault = find_vault(start)
    if not vault:
        print("No mos vault found (no .mos/config.json at or above the path).", file=sys.stderr)
        sys.exit(2)

    cfg, columns, types, cards = load(vault)
    last = columns[-1] if columns else None

    # Resolve the requested id; allow a case-insensitive / exact match.
    card = cards.get(card_id)
    if not card:
        hits = [c for cid, c in cards.items() if cid.lower() == card_id.lower()]
        card = hits[0] if hits else None
    if not card:
        near = sorted(cid for cid in cards if card_id.lower() in cid.lower())
        msg = "No card with id '%s' found in the board." % card_id
        if near:
            msg += " Did you mean: " + ", ".join(near[:5]) + "?"
        print(msg, file=sys.stderr)
        sys.exit(1)

    known_prefixes = {cid.split("-")[0] for cid in cards}
    deps = [d for d in card["deps"] if d.split("-")[0] in known_prefixes and d != card["id"]]
    unmet = [d for d in deps if d in cards and cards[d]["column"] != last]
    missing = [d for d in deps if d not in cards]
    is_done = card["column"] == last
    is_hidden = card["column"] is None
    has_children = any(c["parent"] == card["id"] for c in cards.values())
    branch = branch_name(card)
    missing_sections = [s for s in READINESS_SECTIONS if s not in card["sections"]]

    if as_json:
        print(json.dumps({
            "id": card["id"], "title": card["title"], "type": card["type"],
            "status": card["status"], "column": card["column"], "file": card["rel"],
            "branch": branch, "parent": card["parent"] or None,
            "is_done": is_done, "is_hidden": is_hidden, "is_container": has_children,
            "unmet_deps": unmet, "missing_deps": missing,
            "has_acceptance": "Acceptance" in card["sections"],
            "missing_sections": missing_sections,
        }, indent=2))
        return

    print(f"\n=== Pre-flight: {card['id']} — {card['title']} ===\n")
    print(f"  type:    {card['type']} ({card['label']})")
    print(f"  status:  {card['status']}  · column [{card['column']}]")
    print(f"  parent:  {card['parent'] or '—'}")
    print(f"  file:    {card['rel']}")
    print(f"  branch:  {branch}")

    flags = []
    if is_done:
        flags.append(f"already in [{last}] — this card looks done; confirm before re-doing it")
    if is_hidden:
        flags.append(f"status '{card['status']}' maps to no column (Deferred/Dropped) — not meant to be worked")
    if has_children:
        flags.append("this card has child cards — it's a container; ship a child story/task, not this")
    if unmet:
        flags.append("waiting on unfinished dependency: " + ", ".join(unmet))
    if missing:
        flags.append("references unknown dependency id(s): " + ", ".join(missing))
    if "Acceptance" not in card["sections"]:
        flags.append("no ## Acceptance section — card may be too thin to execute from alone")
    elif missing_sections:
        flags.append("missing helpful sections: " + ", ".join(missing_sections))

    if flags:
        print("\n  ⚠ Check before you start (pause and ask the human if any of these bite):")
        for f in flags:
            print(f"    - {f}")
    else:
        print("\n  ✓ No structural blockers. Read the card body, plan, and confirm scope.")
    print()


if __name__ == "__main__":
    main()
