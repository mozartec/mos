#!/usr/bin/env python3
"""ship_card.py — pre-flight a single mos card before you start shipping it.

Zero dependencies. Run with Python 3:
    python3 ship_card.py <card-id> [<vaultDir>] [--json]
    python3 ship_card.py <card-id> --finish   # close the card: status -> Done state,
                                              # bump updated, tick Acceptance boxes

A "vault" is any directory containing .mos/config.json. With no vaultDir the script
discovers the nearest vault at or above the current directory; without one it refuses
to run. It is config-driven: types, their labels, states, and the column order all
come from .mos/config.json, so it works on any mos vault.

Given a card id it gathers the facts you need before touching git:
  - locates the card file and reads its frontmatter (type, title, status, parent);
  - computes the branch name from the vault's own type label + the file slug;
  - resolves the card's "Depends on:" ids, parent, and children, printing each one's
    file path and flagging dependencies that aren't done;
  - a container card (one with children) is shippable: its unfinished children are
    reported as in-scope, not treated as an error;
  - checks the body for the readiness sections a cold agent needs (Acceptance, etc.).

It does NOT make decisions. Judging whether the card is truly ready — and pausing to
ask the human when it isn't — is the agent's job (see SKILL.md).
"""
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path

IGNORE = {"node_modules", ".git", ".angular", ".turbo", "dist", ".cache"}

# Body sections that signal a card is written to the "cold agent can execute it" bar.
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
    areas = cfg.get("areas", {}) or {}  # vault-defined surfaces (ADR-021)
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
            "touches": parse_list(data.get("touches")),  # declared areas, [] or None
            "sections": [s for s in READINESS_SECTIONS if re.search(r"^#{1,6}\s.*" + s, body, re.M | re.I)],
            "path": f, "rel": rel, "stem": f.stem,
        }
    return cfg, columns, types, areas, cards


def branch_name(card):
    """<label>/<id>-<slug>, label lower-cased. Prefer the file slug (already
    human-curated); fall back to the title."""
    stem, cid = card["stem"], card["id"]
    slug = stem[len(cid) + 1:] if stem.startswith(cid + "-") else slugify(card["title"])
    return f"{card['label'].lower()}/{cid}-{slug}"


def set_frontmatter_field(text: str, field: str, value: str):
    """Replace `field: value` inside the leading frontmatter block, leaving everything
    else byte-for-byte. Inserts the field before the closing `---` if absent. This is
    the narrow, allowed agent write: frontmatter only."""
    m = re.match(r"^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)", text)
    if not m:
        return text, False
    head, fm, tail = m.group(1), m.group(2), m.group(3)
    line_re = re.compile(r"^(" + re.escape(field) + r":[ \t]*).*$", re.M)
    if line_re.search(fm):
        fm = line_re.sub(lambda mm: mm.group(1) + value, fm, count=1)
    else:
        fm = fm + "\n" + field + ": " + value
    return head + fm + tail + text[m.end():], True


def tick_acceptance(text: str):
    """Tick every `- [ ]` in the card's own `## Acceptance` section only — the one
    prose edit the write rules permit. Other prose is left untouched."""
    m = re.match(r"^---\r?\n[\s\S]*?\r?\n---\r?\n?", text)
    fm_end = m.end() if m else 0
    body = text[fm_end:]
    sec = re.search(r"(?:^|\n)#{1,6}[ \t]+Acceptance\b[^\n]*\n", body, re.I)
    if not sec:
        return text, 0
    start = sec.end()
    nxt = re.search(r"\n#{1,6}[ \t]", body[start:])
    end = start + nxt.start() if nxt else len(body)
    new_block, n = re.subn(r"^(\s*[-*][ \t]*)\[ \]", r"\1[x]", body[start:end], flags=re.M)
    return text[:fm_end] + body[:start] + new_block + body[end:], n


def finish(columns, types, card):
    """Deterministically close a card: set frontmatter `status` to the type's state
    mapping to the last column, bump `updated`, and tick its Acceptance boxes."""
    last = columns[-1] if columns else None
    states = types[card["type"]]["states"]
    done = next((s for s, col in states.items() if col == last), None)
    if not done:
        print(f"No Done state for type '{card['type']}' (no status maps to [{last}]).", file=sys.stderr)
        sys.exit(1)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = card["path"].read_text("utf-8")
    text, _ = set_frontmatter_field(text, "status", done)
    text, _ = set_frontmatter_field(text, "updated", now)
    text, ticked = tick_acceptance(text)
    card["path"].write_text(text, "utf-8")
    print(f"✓ {card['id']}: status -> {done}, updated {now}, ticked {ticked} acceptance box(es) "
          f"in {card['rel']}. Include this in your final commit.")


def main():
    args = sys.argv[1:]
    as_json = "--json" in args
    as_finish = "--finish" in args
    args = [a for a in args if a not in ("--json", "--finish")]
    unknown = [a for a in args if a.startswith("--")]
    if unknown or not args:
        if unknown:
            print(f"Unknown option(s): {', '.join(unknown)}", file=sys.stderr)
        print("usage: ship_card.py <card-id> [<vaultDir>] [--json] [--finish]", file=sys.stderr)
        sys.exit(2)

    card_id = args[0]
    start = Path(args[1]) if len(args) > 1 else Path.cwd()
    vault = find_vault(start)
    if not vault:
        print(f"Not a mos vault: no .mos/config.json found at or above '{start}'. "
              "This skill requires one — refusing to start.", file=sys.stderr)
        sys.exit(2)

    cfg, columns, types, areas, cards = load(vault)
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

    if as_finish:
        finish(columns, types, card)
        return

    known_prefixes = {cid.split("-")[0] for cid in cards}
    deps = [d for d in card["deps"] if d.split("-")[0] in known_prefixes and d != card["id"]]
    unmet = [d for d in deps if d in cards and cards[d]["column"] != last]
    missing = [d for d in deps if d not in cards]
    is_done = card["column"] == last
    is_hidden = card["column"] is None
    children = sorted((c for c in cards.values() if c["parent"] == card["id"]), key=lambda c: c["id"])
    open_children = [c for c in children if c["column"] != last]
    branch = branch_name(card)
    missing_sections = [s for s in READINESS_SECTIONS if s not in card["sections"]]
    parent_file = cards[card["parent"]]["rel"] if card["parent"] in cards else None

    # Surface overlap (ADR-021): cards already in flight — in the column before the
    # last, the counterpart of "last column is done" — whose declared `touches`
    # share an area with this card. Compared by name, like the validator; a card
    # with no `touches` (or `touches: []`) raises nothing, so vaults that declare no
    # surfaces stay silent. This is a doubt, not a gate — the agent decides.
    inflight_col = columns[len(columns) - 2] if len(columns) >= 3 else None
    inflight_overlaps = []
    if inflight_col is not None and card["touches"]:
        for c in cards.values():
            if c["id"] == card["id"] or c["column"] != inflight_col:
                continue
            shared = [a for a in card["touches"] if a in (c["touches"] or [])]
            if shared:
                inflight_overlaps.append({"id": c["id"], "areas": shared, "file": c["rel"]})
        inflight_overlaps.sort(key=lambda o: o["id"])
    deps_detail = [
        {"id": d, "file": cards[d]["rel"] if d in cards else None,
         "status": cards[d]["status"] if d in cards else None,
         "met": d in cards and cards[d]["column"] == last}
        for d in deps
    ]
    children_detail = [
        {"id": c["id"], "file": c["rel"], "status": c["status"], "done": c["column"] == last}
        for c in children
    ]

    if as_json:
        print(json.dumps({
            "id": card["id"], "title": card["title"], "type": card["type"],
            "status": card["status"], "column": card["column"], "file": card["rel"],
            "branch": branch, "parent": card["parent"] or None, "parent_file": parent_file,
            "is_done": is_done, "is_hidden": is_hidden,
            "children": children_detail, "open_children": [c["id"] for c in open_children],
            "deps": deps_detail, "unmet_deps": unmet, "missing_deps": missing,
            "has_acceptance": "Acceptance" in card["sections"],
            "missing_sections": missing_sections,
            "touches": card["touches"], "inflight_overlaps": inflight_overlaps,
        }, indent=2))
        return

    print(f"\n=== Pre-flight: {card['id']} — {card['title']} ===\n")
    print(f"  type:    {card['type']} ({card['label']})")
    print(f"  status:  {card['status']}  · column [{card['column']}]")
    parent_disp = card["parent"] or "—"
    if parent_file:
        parent_disp += f"  → {parent_file}"
    print(f"  parent:  {parent_disp}")
    print(f"  file:    {card['rel']}")
    print(f"  branch:  {branch}")
    if deps_detail:
        print("  deps:")
        for d in deps_detail:
            if d["file"]:
                mark = "✓ done" if d["met"] else f"✗ {d['status']}"
                print(f"    - {d['id']}  ({mark})  → {d['file']}")
            else:
                print(f"    - {d['id']}  (not found in board)")
    if children_detail:
        print("  children (in scope if not done):")
        for c in children_detail:
            mark = "✓ done" if c["done"] else f"✗ {c['status']}"
            print(f"    - {c['id']}  ({mark})  → {c['file']}")

    flags = []
    if is_done:
        flags.append(f"already in [{last}] — this card looks done; confirm before re-doing it")
    if is_hidden:
        flags.append(f"status '{card['status']}' maps to no column — not meant to be worked")
    if unmet:
        flags.append("waiting on unfinished dependency: " + ", ".join(unmet))
    if missing:
        flags.append("references unknown dependency id(s): " + ", ".join(missing))
    if "Acceptance" not in card["sections"]:
        flags.append("no ## Acceptance section — card may be too thin to execute from alone")
    elif missing_sections:
        flags.append("missing helpful sections: " + ", ".join(missing_sections))
    for o in inflight_overlaps:
        flags.append(f"touches overlap: {o['id']} is in flight (in '{inflight_col}') and also "
                     f"declares area(s) {', '.join(o['areas'])} — coordinate or sequence the two "
                     "to avoid a merge conflict")

    if open_children:
        print(f"\n  ℹ Container card: shipping it includes its {len(open_children)} "
              f"unfinished child card(s): " + ", ".join(c["id"] for c in open_children))
    if flags:
        print("\n  ⚠ Check before you start (pause and ask the human if any of these bite):")
        for f in flags:
            print(f"    - {f}")
    else:
        print("\n  ✓ No structural blockers. Read the card body, plan, and confirm scope.")
    print()


if __name__ == "__main__":
    main()
