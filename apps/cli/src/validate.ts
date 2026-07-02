/**
 * `mos validate` (F-029, ADR-012): check one or more vaults against their
 * `.mos/config.json` and exit non-zero if any has errors — a CI gate in any
 * repo that has the CLI. Read-only over the vault (ADR-002).
 *
 * The validation *rules* live in `@mos/core` (`validateVault`, graduated in
 * T-017), and so do the report assembly + rendering (`buildValidationReport` /
 * `formatValidationReport`, T-022) that `scripts/validate-vault.mjs` shares for
 * `bun run validate` — the two entry points print the same report because they
 * call the same code, never a copy. This file is only the I/O shell: discover
 * vaults, read files, parse cards with core's parser, build the model.
 */
import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  buildModel,
  buildValidationReport,
  formatValidationReport,
  globToRegExp,
  loadConfig,
  type ParsedFile,
  parseFile,
  SUPPORTED_SPEC_VERSION,
  toPosixPath,
  type ValidationReport,
} from '@mos/core';

/**
 * Directories never recursed into when discovering vaults or reading cards:
 * dependency/build dirs plus any hidden directory (`.git`, `.claude/worktrees`,
 * `.vscode`, …), mirroring the server's file walk so `mos validate` and the
 * running app agree on what's in the vault. `.mos` is the kept exception — it
 * holds the config. The former named entries (`.git`/`.angular`/`.turbo`/
 * `.cache`) are themselves hidden, so the hidden-dir rule subsumes them.
 */
const IGNORE = new Set(['node_modules', 'dist']);
function ignoredDir(name: string): boolean {
  return IGNORE.has(name) || (name.startsWith('.') && name !== '.mos');
}

/** One vault's report (core's {@link ValidationReport}) plus its root path. */
export type VaultReport = ValidationReport & { root: string };

/** Is `dir` a vault root? (A folder holding `.mos/config.json`.) */
export function isVault(dir: string): boolean {
  return existsSync(join(dir, '.mos', 'config.json'));
}

/** Every vault at or under `start` (the start dir itself counts if it is one). */
export function discoverVaults(start: string): string[] {
  const found: string[] = [];
  const rec = (dir: string): void => {
    if (isVault(dir)) found.push(dir);
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      // Discovery never descends into .mos either — no nested vault lives there.
      if (ignoredDir(entry.name) || entry.name === '.mos') continue;
      // Don't follow symlinked directories — a link back up the tree would
      // cycle (and rediscover the same vault under a new path).
      if (entry.isDirectory()) rec(join(dir, entry.name));
    }
  };
  rec(start);
  return found;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDir(entry.name)) continue;
    const p = join(dir, entry.name);
    // Recurse only into real directories and collect only real files; skipping
    // symlinks avoids cycles and keeps the walk inside the vault.
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile()) acc.push(p);
  }
  return acc;
}

/**
 * Validate the vault rooted at `root`: load its config, parse the board-scope
 * cards with core's parser, then hand the model + config + file list to core's
 * `buildValidationReport` (which runs the pure `validateVault` and lays out the
 * board — including the narrow `config:`-error filtering, documented there).
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

  return {
    root,
    ...buildValidationReport(build, config, relPaths, { configErrors, fallbackName: root }),
  };
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
  const body = reports.map(formatValidationReport).join('\n');
  const tail = totalErrors === 0 ? '\nALL VAULTS VALID\n' : `\n${totalErrors} ERROR(S)\n`;

  return { output: `${head}\n${body}\n${tail}`, exitCode: totalErrors === 0 ? 0 : 1 };
}
