# AGENTS.md — Wander (refine eval fixture)

A tiny mos vault for evaluating the refine-batch skill. Treat it like any user vault;
all vocabulary (types, states, columns, areas) comes from `.mos/config.json` and is
deliberately unlike any other vault's.

## Refinement boundary

- A card in its type's **initial state — `Sketch`** — is a draft: refinement may rewrite
  its prose, split it, and add new cards. A card in any later state (`Lined Up`,
  `Underway`, `Landed`) is **decided** — frontmatter only, never rewrite its prose.
- New cards get `created` and `updated` (ISO 8601 UTC) and a fresh id; bump `updated` on
  every edit. Emit frontmatter in the `fieldOrder` from config.
- There is no validator here; checking a card by hand is the full check.

## Card template (raise a `Sketch` card to this)

```markdown
## Outcome
One paragraph: what is true once this card is done.

## Context — read before starting
The docs/cards to read, each with a one-line why.

## Constraints (must honor)
The rules this card must not break.

## Plan
Concrete ordered steps.

## Acceptance
A checkbox list that defines done.

## Dependencies
Depends on: … / Blocks: …

## Out of scope
What NOT to touch.
```

## Areas

`registry` is a **hub**: `app/registry.ts` is the single manifest every feature must edit
to register itself, so any two cards that touch it conflict. `flights`, `hotels`, `cars`
are **module** areas (one feature each); `guide` is the prose area. Concentrate hub edits
in one card so the rest stay disjoint.
