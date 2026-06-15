#!/usr/bin/env bun
// validate-vault.mjs — check a mos vault against its .mos/config.json.
//
// The validation rules live in @mos/core (validateVault); this script is the
// thin I/O shell around them — it discovers vaults, reads files, parses cards
// with core's parser, builds the model, and prints the report. Because it
// imports core's TypeScript source (no dist/, ADR-008), run it with Bun:
//   bun run validate            # this repo's vault
//   bun scripts/validate-vault.mjs <vaultDir> [<vaultDir> ...]
//
// With no args it auto-discovers every vault (a directory containing
// .mos/config.json) under the current directory. Exits non-zero if any vault
// has errors, so it doubles as a CI gate. The same core validateVault backs the
// `mos validate` CLI for any repo (F-029).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  loadConfig,
  parseFile,
  buildModel,
  validateVault as validateVaultCore,
  placeCard,
  sortWithinColumn,
  globToRegExp,
  toPosixPath,
} from '../packages/core/src/index.js';

const IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Validate one vault rooted at `root`. The I/O half of the validator: read the
 * config, walk the tree, parse the board-scope cards with core's parser, then
 * hand the parsed model + config + file list to core's pure validateVault. The
 * returned object carries the diagnostics (errors/warnings) plus the board view
 * printReport renders — both built here, nothing validated here.
 */
export function validateVault(root) {
  const { config, errors: configErrors } = loadConfig(
    readFileSync(join(root, '.mos', 'config.json'), 'utf8'),
  );

  const files = walk(root);
  const relPaths = files.map((f) => toPosixPath(relative(root, f)));

  // Parse the board-scope markdown into cards with core's real parser, the way
  // the app and the `mos validate` CLI (F-029) do — no inlined frontmatter parser.
  const boardMatchers = config.board.include.map(globToRegExp);
  const parsed = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const rel = toPosixPath(relative(root, f));
    if (!boardMatchers.some((re) => re.test(rel))) continue;
    parsed.push(parseFile(rel, readFileSync(f, 'utf8')));
  }
  const build = buildModel(parsed, config);

  const { errors, warnings } = validateVaultCore(build, config, relPaths);

  // loadConfig owns config normalization; only its fundamental failures
  // (unparseable / not an object) are surfaced here. Every semantic check the
  // validator promises lives in core's validateVault, so its richer config
  // diagnostics are intentionally not double-reported.
  const allErrors = [...configErrors.filter((e) => e.startsWith('config:')), ...errors];

  // Lay the cards out by column for the human-readable report — presentation
  // only, reusing core's placement and within-column sort.
  const cards = Object.values(build.model.cards);
  const board = Object.fromEntries(config.board.columns.map((c) => [c, []]));
  const hidden = [];
  for (const card of cards) {
    const column = placeCard(card, config).column;
    (column == null ? hidden : board[column]).push(card);
  }
  for (const column of config.board.columns) {
    board[column] = sortWithinColumn(board[column], config);
  }

  return {
    errors: allErrors,
    warnings,
    name: config.vault.name || root,
    specVersion: config.specVersion || undefined,
    cardCount: cards.length,
    columns: config.board.columns,
    board,
    hidden,
  };
}

// Print one vault's report. The output is the validator's human-facing surface;
// it reads the card shape core returns (status, priority, title, and parent in
// fields). The importable validateVault is side-effect free; only the CLI prints.
function printReport({ name, specVersion, cardCount, columns, board, hidden, warnings, errors }) {
  console.log(
    `\n${'='.repeat(60)}\nVAULT: ${name}  (specVersion ${specVersion ?? '?'}, ${cardCount} cards)\n${'='.repeat(60)}`,
  );
  for (const col of columns) {
    console.log(`\n  [${col}] (${board[col].length})`);
    for (const c of board[col]) {
      const badge = c.status === 'Blocked' ? ' *BLOCKED*' : '';
      const par = c.fields?.parent ? `  ^${c.fields.parent}` : '';
      console.log(`    ${c.id.padEnd(12)} ${c.priority ?? '--'} ${c.title ?? ''}${par}${badge}`);
    }
  }
  if (hidden.length) {
    console.log(`\n  [hidden/off-board] (${hidden.length})`);
    for (const c of hidden)
      console.log(`    ${c.id.padEnd(12)} ${(c.status ?? '').padEnd(9)} ${c.title ?? ''}`);
  }
  if (warnings.length) {
    console.log(`\n  WARNINGS (${warnings.length}, non-fatal):`);
    for (const w of warnings) console.log(`    ! ${w}`);
  }
  console.log(errors.length ? `\n  ERRORS (${errors.length}):` : `\n  OK — valid`);
  for (const e of errors) console.log(`    x ${e}`);
}

function discover(start) {
  const found = [];
  (function rec(dir) {
    if (existsSync(join(dir, '.mos', 'config.json'))) found.push(dir);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (IGNORE.has(name) || name === '.mos') continue;
      let st;
      try {
        st = statSync(join(dir, name));
      } catch {
        continue;
      }
      if (st.isDirectory()) rec(join(dir, name));
    }
  })(start);
  return found;
}

// CLI entry — gated on import.meta.main so importing this module (e.g. the
// test suite) runs no discovery, printing, or process.exit (T-011).
if (import.meta.main) {
  const args = process.argv.slice(2);
  const roots = args.length ? args : discover(process.cwd());
  if (!roots.length) {
    console.error('No vault found (no .mos/config.json under cwd).');
    process.exit(2);
  }
  let total = 0;
  for (const r of roots) {
    const result = validateVault(r);
    printReport(result);
    total += result.errors.length;
  }
  console.log(`\n${total === 0 ? 'ALL VAULTS VALID' : total + ' ERROR(S)'}\n`);
  process.exit(total === 0 ? 0 : 1);
}
