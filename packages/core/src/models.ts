/**
 * Placeholder vault model types for the mos core.
 *
 * These are intentionally minimal: T-001 only needs the shape the app shell and
 * the {@link VaultSource} adapter compile against. Real parsing, link resolution,
 * and board layout arrive in later tasks (F-003, F-004). The core stays pure —
 * plain TypeScript over strings and objects, no framework and no I/O (ADR-001).
 */

/** A single card parsed from a markdown file's frontmatter and body. */
export interface Card {
  /** Stable identifier, e.g. `T-001`. */
  id: string;
  /** Card type as declared in `.mos/config.json` (e.g. `task`, `story`). */
  type: string;
  /** Human-readable title. */
  title: string;
  /** Workflow state, mapped to a board column by the card's type. */
  status: string;
  /** Vault-relative path of the source file. */
  path: string;
}

/** The whole vault parsed into memory. The app renders its views from this. */
export interface VaultModel {
  /** Every card discovered in the vault, keyed by {@link Card.id}. */
  cards: Record<string, Card>;
  /** Vault-relative paths of all markdown files, in listing order. */
  files: string[];
}

/** An empty model: the starting point before any files are parsed. */
export function createEmptyVaultModel(): VaultModel {
  return { cards: {}, files: [] };
}
