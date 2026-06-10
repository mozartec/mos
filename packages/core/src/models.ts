/**
 * Placeholder vault model types for the mos core.
 *
 * These are intentionally minimal: T-001 only needs the shape the app shell and
 * the {@link VaultSource} adapter compile against. Real parsing, link resolution,
 * and board layout arrive in later tasks (F-003, F-004). The core stays pure —
 * plain TypeScript over strings and objects, no framework and no I/O (ADR-001).
 */

import type { VaultConfig } from './config.js';
import type { ParsedFile } from './parse-file.js';
import { globToRegExp, toPosixPath } from './path-glob.js';

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
  /** Priority for sorting within a column (e.g. P0, P1, P2, P3). Optional. */
  priority?: string;
  /** Raw frontmatter parsed fields as a generic map. */
  fields: Record<string, unknown>;
}

/** The whole vault parsed into memory. The app renders its views from this. */
export interface VaultModel {
  /** Every card discovered in the vault, keyed by {@link Card.id}. */
  cards: Record<string, Card>;
  /** Vault-relative paths of wiki-scope markdown files, in listing order. */
  files: string[];
}

/** An empty model: the starting point before any files are parsed. */
export function createEmptyVaultModel(): VaultModel {
  return { cards: {}, files: [] };
}

/** Result of {@link buildModel}: assembled model plus non-fatal diagnostics. */
export interface BuildModelResult {
  model: VaultModel;
  diagnostics: string[];
}

/**
 * Build an in-memory model from parsed files and vault config.
 *
 * A file is a card iff it is in board scope (`config.board.include`) and has a
 * recognized frontmatter `type` (ADR-003). Board-scope files without a
 * recognized type are reported as "not a card", not silently dropped.
 */
export function buildModel(
  files: ParsedFile[],
  config: VaultConfig,
): BuildModelResult {
  const model = createEmptyVaultModel();
  const diagnostics: string[] = [];
  const wikiIncludeMatchers = config.wiki.include.map(globToRegExp);
  const wikiExcludeMatchers = config.wiki.exclude.map(globToRegExp);
  const boardMatchers = config.board.include.map(globToRegExp);

  for (const file of files) {
    const relPath = toPosixPath(file.path);
    const inWikiScope =
      wikiIncludeMatchers.some((re) => re.test(relPath)) &&
      !wikiExcludeMatchers.some((re) => re.test(relPath));
    if (inWikiScope) model.files.push(file.path);

    indexCard(model, diagnostics, file, relPath, boardMatchers, config);
  }

  return { model, diagnostics };
}

/**
 * Index one parsed file into `model.cards` if it is a board-scope card.
 * Mutates `model`/`diagnostics`; shared by {@link buildModel} (over a fresh
 * model) and {@link applyFileChange} (over a cloned one).
 */
function indexCard(
  model: VaultModel,
  diagnostics: string[],
  file: ParsedFile,
  relPath: string,
  boardMatchers: RegExp[],
  config: VaultConfig,
): void {
  const inBoardScope = boardMatchers.some((re) => re.test(relPath));
  if (!inBoardScope) return;

  const type = asScalarString(file.data['type']);
  if (type === '' || config.types[type] === undefined) {
    diagnostics.push(`${file.path}: not a card (unrecognized or missing type)`);
    return;
  }

  const id = asScalarString(file.data['id']);
  if (id === '') {
    diagnostics.push(`${file.path}: card has no id`);
    return;
  }

  if (model.cards[id] !== undefined) {
    diagnostics.push(`duplicate id '${id}' (${file.path})`);
    return;
  }

  model.cards[id] = {
    id,
    type,
    title: asScalarString(file.data['title']),
    status: asScalarString(file.data['status']),
    path: file.path,
    priority: asScalarString(file.data['priority']) || undefined,
    fields: file.data,
  };
}

/**
 * Incrementally patch a model for one changed file (F-005-S-01).
 *
 * Removes every trace of `path` from the model, then — unless `file` is
 * `null`, meaning the file was deleted — re-indexes the freshly parsed file
 * the same way {@link buildModel} would. Only the changed file is examined;
 * everything else is carried over untouched. Returns a **new** model so
 * signal-based views detect the change; the input model is never mutated.
 *
 * A duplicate-id collision with a *different* file is reported in
 * `diagnostics` and the change is skipped, mirroring {@link buildModel}.
 */
export function applyFileChange(
  model: VaultModel,
  config: VaultConfig,
  path: string,
  file: ParsedFile | null,
): BuildModelResult {
  const diagnostics: string[] = [];
  const relPath = toPosixPath(path);

  // Clone without any entry owned by `path`, remembering the wiki-list slot
  // so an updated file keeps its position in listing order.
  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(model.cards)) {
    if (toPosixPath(card.path) !== relPath) cards[id] = card;
  }
  const previousIndex = model.files.findIndex((f) => toPosixPath(f) === relPath);
  const files = model.files.filter((f) => toPosixPath(f) !== relPath);
  const next: VaultModel = { cards, files };

  if (file !== null) {
    const inWikiScope =
      config.wiki.include.map(globToRegExp).some((re) => re.test(relPath)) &&
      !config.wiki.exclude.map(globToRegExp).some((re) => re.test(relPath));
    if (inWikiScope) {
      if (previousIndex >= 0) next.files.splice(previousIndex, 0, file.path);
      else next.files.push(file.path);
    }

    indexCard(next, diagnostics, file, relPath, config.board.include.map(globToRegExp), config);
  }

  return { model: next, diagnostics };
}

function asScalarString(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
    ? String(value)
    : '';
}
