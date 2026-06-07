# AGENTS.md — how to manage this vault's backlog

This repository is a mos vault. You (an AI assistant) may create and update **cards** in
`board/` when asked. A card is a markdown file. Follow these rules exactly. Full format:
[`docs/05-VAULT_SPEC.md`](docs/05-VAULT_SPEC.md).

## Creating a card

1. Put the file in `board/`, named `<id>-<slug>.md` (e.g. `board/F-012-search.md`).
2. Add YAML frontmatter at the very top. Required: `id`, `type`, `title`, `status`.
3. `type` is one of: `feature`, `story`, `task` (defined in `.mos/config.json`).
4. `status` must be allowed for that type:
   - feature: Draft | Planned | In Progress | Done | Deferred | Dropped
   - story:   Todo | Planned | In Progress | Blocked | Done
   - task:    Todo | Planned | In Progress | Done | Deferred
5. `id` is unique and stable. Stories use the parent feature id as a prefix and set
   `parent: <feature-id>` (one nesting level only — a story's parent must be a feature).
6. Optional fields shown on the card: `phase` (MVP/Phase 2/Future), `priority` (P0–P3),
   `owner`, `sprint` (S1/S2/S3), `estimate` (XS–XL, stories).

## Updating a card

- **Only edit the frontmatter block. Never rewrite the prose body.**
- Move a card on the board by changing `status`; schedule it by setting `sprint`.
- Parse frontmatter, change the field, write it back — do not blind find-and-replace.

## Do not

- Do not invent `type` or `status` values not in `.mos/config.json`.
- Do not create cards outside `board/`.
- Do not edit files in `docs/` as if they were cards — they are wiki pages.
