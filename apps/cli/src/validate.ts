/**
 * `mos validate` (F-029, ADR-012): check one or more vaults against their
 * `.mos/config.json` and exit non-zero if any has errors — a CI gate in any
 * repo that has the CLI. Read-only over the vault (ADR-002).
 *
 * The validation *rules* live in `@mos/core` (`validateVault`, graduated in
 * T-017); this file is only the I/O shell — discover vaults, read files, parse
 * cards with core's parser, build the model, render the report. It mirrors the
 * report that `scripts/validate-vault.mjs` prints for `bun run validate`, so the
 * two entry points read the same; both call the one core validator, never a copy
 * of the rules.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  buildModel,
  globToRegExp,
  loadConfig,
  type Card,
  type ParsedFile,
  parseFile,
  placeCard,
  sortWithinColumn,
  SUPPORTED_SPEC_VERSION,
  toPosixPath,
  validateVault as validateVaultCore,
} from '@mos/core';

/** Directories never worth walking when discovering vaults or reading cards. */
const IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

/** One vault's validation outcome plus the board view the report renders. */
export interface VaultReport {
  root: string;
  name: string;
  specVersion?: string;
  cardCount: number;
  columns: string[];
  board: Record<string, Card[]>;
  hidden: Card[];
  warnings: string[];
  errors: string[];
}

/** Is `dir` a vault root? (A folder holding `.mos/config.json`.) */
export function isVault(dir: string): boolean {
  return existsSync(join(dir, '.mos', 'config.json'));
}

/** Every vault at or under `start` (the start dir itself counts if it is one). */
export function discoverVaults(start: string): string[] {
  const found: string[] = [];
  const rec = (dir: string): void => {
    if (isVault(dir)) found.push(dir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (IGNORE.has(name) || name === '.mos') continue;
      let dirent;
      try {
        dirent = statSync(join(dir, name));
      } catch {
        continue;
      }
      if (dirent.isDirectory()) rec(join(dir, name));
    }
  };
  rec(start);
  return found;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    let dirent;
    try {
      dirent = statSync(p);
    } catch {
      continue;
    }
    if (dirent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Validate the vault rooted at `root`: load its config, parse the board-scope
 * cards with core's parser, then hand the model + config + file list to core's
 * pure `validateVault`. Only `config:`-prefixed loadConfig errors (invalid JSON
 * / not an object — the config is unusable) are surfaced alongside; core owns
 * every semantic rule.
 */
export function validateVaultAt(root: string): VaultReport {
  const { config, errors: configErrors } = loadConfig(
    readFileSync(join(root, '.mos', 'config.json'), 'utf8'),
  );

  const files = walk(root);
  const relPaths = files.map((f) => toPosixPath(relative(root, f)));

  const boardMatchers = config.board.include.map(globToRegExp);
  const parsed: ParsedFile[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const rel = toPosixPath(relative(root, f));
    if (!boardMatchers.some((re) => re.test(rel))) continue;
    parsed.push(parseFile(rel, readFileSync(f, 'utf8')));
  }
  const build = buildModel(parsed, config);

  const { errors, warnings } = validateVaultCore(build, config, relPaths);
  const allErrors = [...configErrors.filter((e) => e.startsWith('config:')), ...errors];

  // Lay the cards out by column for the human-readable report — presentation
  // only, reusing core's placement and within-column sort.
  const cards = Object.values(build.model.cards);
  const board: Record<string, Card[]> = Object.fromEntries(
    config.board.columns.map((c) => [c, []]),
  );
  const hidden: Card[] = [];
  for (const card of cards) {
    const column = placeCard(card, config).column;
    (column == null ? hidden : board[column]).push(card);
  }
  for (const column of config.board.columns) {
    board[column] = sortWithinColumn(board[column], config);
  }

  return {
    root,
    name: config.vault.name || root,
    specVersion: config.specVersion || undefined,
    cardCount: cards.length,
    columns: config.board.columns,
    board,
    hidden,
    warnings,
    errors: allErrors,
  };
}

/** Render one vault's report as text (mirrors `validate-vault.mjs`'s output). */
export function formatVaultReport(r: VaultReport): string {
  const bar = '='.repeat(60);
  const out: string[] = [
    `\n${bar}\nVAULT: ${r.name}  (specVersion ${r.specVersion ?? '?'}, ${r.cardCount} cards)\n${bar}`,
  ];
  for (const col of r.columns) {
    out.push(`\n  [${col}] (${r.board[col].length})`);
    for (const c of r.board[col]) {
      const badge = c.status === 'Blocked' ? ' *BLOCKED*' : '';
      const par = c.fields.parent ? `  ^${String(c.fields.parent)}` : '';
      out.push(`    ${c.id.padEnd(12)} ${c.priority ?? '--'} ${c.title}${par}${badge}`);
    }
  }
  if (r.hidden.length) {
    out.push(`\n  [hidden/off-board] (${r.hidden.length})`);
    for (const c of r.hidden) out.push(`    ${c.id.padEnd(12)} ${c.status.padEnd(9)} ${c.title}`);
  }
  if (r.warnings.length) {
    out.push(`\n  WARNINGS (${r.warnings.length}, non-fatal):`);
    for (const w of r.warnings) out.push(`    ! ${w}`);
  }
  out.push(r.errors.length ? `\n  ERRORS (${r.errors.length}):` : `\n  OK — valid`);
  for (const e of r.errors) out.push(`    x ${e}`);
  return out.join('\n');
}

/** Result of a `mos validate` run: the text to print and the exit code. */
export interface ValidateRun {
  output: string;
  exitCode: number;
}

/**
 * Validate the vault(s) at or under `dir` (default: `cwd`). Exit 0 when every
 * vault is clean, 1 when any has errors, 2 when no vault is found.
 */
export function runValidate({ dir, cwd }: { dir?: string; cwd: string }): ValidateRun {
  const start = resolve(dir ?? cwd);
  const roots = discoverVaults(start);
  if (roots.length === 0) {
    return { output: `Not a mos vault: no .mos/config.json at or under '${start}'.`, exitCode: 2 };
  }

  const reports = roots.map(validateVaultAt);
  const totalErrors = reports.reduce((n, r) => n + r.errors.length, 0);

  const head = `mos validate · vault format spec ≤ ${SUPPORTED_SPEC_VERSION} supported`;
  const body = reports.map(formatVaultReport).join('\n');
  const tail = totalErrors === 0 ? '\nALL VAULTS VALID\n' : `\n${totalErrors} ERROR(S)\n`;

  return { output: `${head}\n${body}\n${tail}`, exitCode: totalErrors === 0 ? 0 : 1 };
}
