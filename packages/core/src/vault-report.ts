/**
 * The shared vault-report assembly + renderer (T-022).
 *
 * `mos validate` (apps/cli) and `bun run validate` (scripts/validate-vault.mjs)
 * print the same report; each used to hold its own copy of the assembly (board
 * layout, hidden/off-board, counts, errors + warnings) and the string rendering,
 * verified byte-identical by hand (PR #67) — the exact "two copies in step" rot
 * ADR-007 stamps out. This module is the one source both consume. It stays pure
 * (ADR-001): parsed data + config in, report data / a string out — file
 * discovery and reading remain in each entry point's own I/O layer.
 */

import type { VaultConfig } from './config.js';
import type { BuildModelResult, Card } from './models.js';
import { placeCard, sortWithinColumn } from './place-card.js';
import { validateVault } from './validate.js';

/** One vault's validation outcome plus the board view the report renders. */
export interface ValidationReport {
  /** Display name: `vault.name`, else the caller's fallback (e.g. the root path). */
  name: string;
  specVersion: string | undefined;
  cardCount: number;
  columns: string[];
  board: Record<string, Card[]>;
  hidden: Card[];
  warnings: string[];
  errors: string[];
}

/**
 * Assemble one vault's report: run core's {@link validateVault} and lay the
 * cards out by column — presentation only, reusing core's placement and
 * within-column sort.
 *
 * `configErrors` are loadConfig's diagnostics; only its two fundamental,
 * config-unusable errors — invalid JSON / not an object — which it alone
 * prefixes with `config:` are surfaced. Its semantic diagnostics (field types,
 * colors, idPattern, enum sources) are deliberately NOT forwarded: those checks
 * are core validateVault's contract, and surfacing loadConfig's would both add
 * rules the validator doesn't promise and change `validate` output. Keep this
 * filter narrow — widening it past the `config:` fundamentals re-introduces
 * both. (If core ever gives a config:-prefixed semantic error, switch this to
 * an explicit "config unusable" signal.)
 */
export function buildValidationReport(
  build: BuildModelResult,
  config: VaultConfig,
  paths: string[],
  options: { configErrors?: string[]; fallbackName?: string } = {},
): ValidationReport {
  const { errors, warnings } = validateVault(build, config, paths);
  const configErrors = (options.configErrors ?? []).filter((e) => e.startsWith('config:'));
  const allErrors = [...configErrors, ...errors];

  const cards = Object.values(build.model.cards);
  const board: Record<string, Card[]> = Object.fromEntries(
    config.board.columns.map((c) => [c, []]),
  );
  const hidden: Card[] = [];
  for (const card of cards) {
    const column = placeCard(card, config).column;
    // A status mapping to a column outside board.columns is a config error core
    // already reports; route it off-board (Object.hasOwn, not `in`, dodges
    // prototype keys like `constructor`) so the report renders that error
    // instead of crashing on a missing column bucket.
    (column == null || !Object.hasOwn(board, column) ? hidden : board[column]).push(card);
  }
  for (const column of config.board.columns) {
    board[column] = sortWithinColumn(board[column], config);
  }

  return {
    name: config.vault.name || (options.fallbackName ?? ''),
    specVersion: config.specVersion || undefined,
    cardCount: cards.length,
    columns: config.board.columns,
    board,
    hidden,
    warnings,
    errors: allErrors,
  };
}

/** Render one vault's report as text — the validator's human-facing surface. */
export function formatValidationReport(r: ValidationReport): string {
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
