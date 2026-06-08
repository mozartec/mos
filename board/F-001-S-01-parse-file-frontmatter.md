---
id: F-001-S-01
type: story
title: Parse a markdown file and its frontmatter
status: Done
created: 2026-06-07T13:00:00Z
updated: 2026-06-08T12:08:04Z
priority: P0
owner: mozart
sprint: S1
parent: F-001
estimate: M
---

# F-001-S-01 — Parse a markdown file and its frontmatter

Split a file into its YAML frontmatter and body; return a typed object plus the raw body.

## Outcome

`packages/core` exposes `parseFile(path, text) -> { path; data: Record<string, unknown>;
body: string; errors: string[] }`. Valid frontmatter becomes `data`; the markdown after the
fence becomes `body`; a file with no frontmatter yields `data: {}` and the full text as
`body`. Invalid YAML is reported in `errors`, never thrown.

## Context — read before starting

- [`docs/05-VAULT_SPEC.md`](../docs/05-VAULT_SPEC.md) §4 — the frontmatter block shape
  (`---` fenced YAML, then freeform body).
- [`scripts/validate-vault.mjs`](../scripts/validate-vault.mjs) lines 49–62 — the interim
  frontmatter regex/parser; the core version should handle the same cases plus real YAML
  (lists, quoted strings) via a small parser.
- [`docs/04-TECH_STACK.md`](../docs/04-TECH_STACK.md) — for the YAML dependency choice (a
  tiny, pure parser such as `yaml`; keep core dependency-light).

## Constraints (must honor)

- Pure core: a string in, an object out. No `fs`. (ADR-001)
- No-throw: bad YAML → `errors` entry, caller still gets `body`.
- Preserve the body verbatim — mos never rewrites prose (ADR-002 discipline applies even to
  the parser).

## Plan

1. Detect a leading `---\n … \n---` block; everything after is `body`.
2. Parse the YAML block with a pure parser; on failure push an error and return `data: {}`.
3. Return `{ path, data, body, errors }`. Add Vitest fixtures: valid frontmatter, none,
   malformed YAML, CRLF line endings.

## Acceptance

- [x] A file with valid frontmatter yields its fields; a file without yields body only.
- [x] Invalid YAML is reported in `errors`, not thrown past the caller.
- [x] The body is returned byte-for-byte (no trimming/rewriting).

## Dependencies

- **Depends on:** T-001. **Blocks:** F-001-S-02.

## Out of scope

Deciding whether the file is a card (F-001-S-02), reference resolution (F-001-S-03), and
rendering. Just split + parse.

## References

ADR-001, ADR-002; `docs/05-VAULT_SPEC.md` §4; `scripts/validate-vault.mjs`.
