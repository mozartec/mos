# Recipe Box — example vault

A tiny, throwaway example to show that the mos format is **not** tied to the mos project
itself. It's a pretend recipe-app backlog with its **own** types and columns:

- Types: `feature` and `bug` (not the `feature/story/task` the main repo uses).
- Columns: `Inbox · Doing · Shipped` (not `Backlog · Planned · In Progress · Done`).
- States are different too — see `.mos/config.json`.

Point mos at this folder and it should render this board correctly with no code changes.
That's the generality test from the MVP acceptance criteria.
