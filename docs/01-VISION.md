---
created: 2026-06-07T13:00:00Z
updated: 2026-06-12T18:30:00Z
---

# Vision

## The problem

Solo developers in 2026 plan by talking to an AI assistant. The output of that planning
is almost always a folder of markdown — a spec here, a task list there, some notes. That
folder is, in effect, a structured backlog. It just has no visual home.

The existing options don't fit:

- **Editors (VS Code)** can render a single markdown file but give you no overview, no
  board, and weak navigation between files. You end up right-click-previewing files one
  at a time.
- **Issue trackers (Jira, Linear)** are excellent boards but live in a cloud database.
  Using them means copying your plan out of your files and into a system that then drifts
  away from them, and that an AI coding agent can't touch as plain text.
- **Note tools (Obsidian, Notion)** give you a wiki but treat project management as a
  bolted-on afterthought, with no real status/dependency model.

Nobody offers the simple thing: point a tool at your markdown folder and see a board.

## What mos is

mos is a local-first desktop tool that puts two read-only lenses over a folder of
markdown you own:

- a **wiki** for reading and navigating the project, and
- a **board** for seeing the work — features, stories, tasks — by status, grouped however
  the vault chooses.

The folder is the single source of truth. There is no database and no cloud. Creating
and updating work happens through your AI assistant, which edits the markdown directly,
guided by a convention file in the vault. mos renders; the agent writes.

## Who it's for

Solo developers and very small teams who already work alongside an AI, want their plan to
stay as portable plain files under their own git history, and want a visual board without
adopting a heavyweight tracker. The personas behind every design call are drawn out in
[`14-PERSONAS.md`](14-PERSONAS.md).

## What success looks like

The honest test is dogfooding: mos is planned in its own format inside this repo. If
managing mos with mos is something its author reaches for daily, the idea works. If it
isn't, we'll learn that here before asking anyone else to adopt it.

The longer-term bet is that "your AI writes the tasks, you see them as a board" is a loop
that fits how solo devs already work — and that keeping everything as local, git-native,
agent-editable markdown is a feature people will value, not a limitation.
