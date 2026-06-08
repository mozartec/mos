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
  const boardMatchers = config.board.include.map(globToRegExp);

  for (const file of files) {
    model.files.push(file.path);

    const relPath = toPosixPath(file.path);
    const inBoardScope = boardMatchers.some((re) => re.test(relPath));
    const type = asString(file.data['type']);
    const isRecognizedType = type !== '' && config.types[type] !== undefined;

    if (!inBoardScope) continue;

    if (!isRecognizedType) {
      diagnostics.push(`${file.path}: not a card (unrecognized or missing type)`);
      continue;
    }

    const id = asString(file.data['id']);
    if (id === '') {
      diagnostics.push(`${file.path}: card has no id`);
      continue;
    }

    if (model.cards[id] !== undefined) {
      diagnostics.push(`duplicate id '${id}' (${file.path})`);
      continue;
    }

    model.cards[id] = {
      id,
      type,
      title: asString(file.data['title']),
      status: asString(file.data['status']),
      path: file.path,
    };
  }

  return { model, diagnostics };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function globToRegExp(glob: string): RegExp {
  const pattern = toPosixPath(glob);
  let re = '^';

  // Supported glob tokens:
  // - `**/` => zero or more path segments
  // - `**`  => any sequence (including `/`)
  // - `*`   => any sequence except `/`
  // - `?`   => exactly one character
  for (let i = 0; i < pattern.length; ) {
    const ch = pattern[i];

    if (ch === '*') {
      const next = pattern[i + 1];
      const charAfterNext = i + 2 < pattern.length ? pattern[i + 2] : '';
      if (next === '*' && charAfterNext === '/') {
        re += '(?:[^/]+/)*';
        i += 3;
        continue;
      }
      if (next === '*') {
        re += '.*';
        i += 2;
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }

    if (ch === '?') {
      re += '.';
      i += 1;
      continue;
    }

    re += escapeRegExpChar(ch);
    i += 1;
  }

  re += '$';
  return new RegExp(re);
}

function escapeRegExpChar(ch: string): string {
  return /[-\\^$.*+?()[\]{}|]/.test(ch) ? `\\${ch}` : ch;
}
