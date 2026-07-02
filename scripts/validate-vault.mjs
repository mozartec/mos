#!/usr/bin/env bun
// validate-vault.mjs — check a mos vault against its .mos/config.json.
//
// The validation rules live in @mos/core (validateVault), and so do the report
// assembly + rendering (buildValidationReport / formatValidationReport, T-022)
// shared with the `mos validate` CLI; this script is the thin I/O shell around
// them — it discovers vaults, reads files, parses cards with core's parser,
// builds the model, and prints the report. Because it imports core's
// TypeScript source (no dist/, ADR-008), run it with Bun:
//   bun run validate            # this repo's vault
//   bun scripts/validate-vault.mjs <vaultDir> [<vaultDir> ...]
//
// With no args it auto-discovers every vault (a directory containing
// .mos/config.json) under the current directory. Exits non-zero if any vault
// has errors, so it doubles as a CI gate. The same core validateVault backs the
// `mos validate` CLI for any repo (F-029).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  loadConfig,
  parseFile,
  buildModel,
  buildValidationReport,
  formatValidationReport,
  globToRegExp,
  toPosixPath,
} from '../packages/core/src/index.js';

const IGNORE = new Set(['node_modules', '.git', '.angular', '.turbo', 'dist', '.cache']);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const p = join(dir, entry.name);
    // Recurse only into real directories and collect only real files; skipping
    // symlinks avoids cycles and keeps the walk inside the vault.
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile()) acc.push(p);
  }
  return acc;
}

/**
 * Validate one vault rooted at `root`. The I/O half of the validator: read the
 * config, walk the tree, parse the board-scope cards with core's parser, then
 * hand the model + config + file list to core's buildValidationReport (which
 * runs the pure validateVault and lays out the board — including the narrow
 * `config:`-error filtering, documented there). Nothing validated here.
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

  return buildValidationReport(build, config, relPaths, { configErrors, fallbackName: root });
}

function discover(start) {
  const found = [];
  (function rec(dir) {
    if (existsSync(join(dir, '.mos', 'config.json'))) found.push(dir);
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name === '.mos') continue;
      // Don't follow symlinked directories — a link back up the tree would
      // cycle (and rediscover the same vault under a new path).
      if (entry.isDirectory()) rec(join(dir, entry.name));
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
    console.log(formatValidationReport(result));
    total += result.errors.length;
  }
  console.log(`\n${total === 0 ? 'ALL VAULTS VALID' : total + ' ERROR(S)'}\n`);
  process.exit(total === 0 ? 0 : 1);
}
