---
id: F-001-S-01
type: story
title: Parse a markdown file and its frontmatter
status: Planned
priority: P0
owner: mozart
sprint: S1
parent: F-001
estimate: M
---

# F-001-S-01 — Parse a markdown file and its frontmatter

Split a file into its YAML frontmatter and body; return a typed object plus the raw body.

Acceptance:
- A file with valid frontmatter yields its fields; a file without frontmatter yields body only.
- Invalid YAML is reported, not thrown past the caller.
