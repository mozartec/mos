import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { buildModel } from './models.js';
import { parseFile } from './parse-file.js';
import {
  buildValidationReport,
  formatValidationReport,
  type ValidationReport,
} from './vault-report.js';

// Drive the assembly the way the two I/O shells (`mos validate` and
// scripts/validate-vault.mjs) do: normalize a (partial) config with loadConfig,
// parse the card bodies, build the model, then assemble the report.
function report(
  configInput: unknown,
  cards: Record<string, string> = {},
  options: { configErrors?: string[]; fallbackName?: string } = {},
): ValidationReport {
  const { config } = loadConfig(JSON.stringify(configInput));
  const parsed = Object.entries(cards).map(([path, body]) => parseFile(path, body));
  const build = buildModel(parsed, config);
  return buildValidationReport(
    build,
    config,
    parsed.map((p) => p.path),
    options,
  );
}

function card(...lines: string[]): string {
  return `---\n${lines.join('\n')}\n---\n\n# card\n`;
}

function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    specVersion: '0.4',
    vault: { name: 'Fixture' },
    board: { include: ['cards/**/*.md'], columns: ['Todo', 'Doing', 'Done'] },
    types: { item: { parent: null, states: { Open: 'Todo', Active: 'Doing', Closed: 'Done' } } },
    ...overrides,
  };
}

describe('buildValidationReport — assembly', () => {
  it('lays cards out by column and counts them', () => {
    const r = report(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
      'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Active'),
    });
    expect(r.name).toBe('Fixture');
    expect(r.specVersion).toBe('0.4');
    expect(r.cardCount).toBe(2);
    expect(r.board['Todo'].map((c) => c.id)).toEqual(['T-1']);
    expect(r.board['Doing'].map((c) => c.id)).toEqual(['T-2']);
    expect(r.errors).toEqual([]);
  });

  it('routes a card whose status maps outside board.columns off-board, not a crash', () => {
    const r = report(baseConfig({ types: { item: { parent: null, states: { Open: 'Nope' } } } }), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
    });
    expect(r.hidden.map((c) => c.id)).toEqual(['T-1']);
    expect(r.errors).toContain("type item: state 'Open' maps to unknown column 'Nope'");
  });

  it('surfaces only config:-prefixed loadConfig errors, ahead of core errors', () => {
    const r = report(
      baseConfig(),
      { 'cards/a.md': card('type: item', 'title: A', 'status: Open') }, // no id — a core error
      { configErrors: ['config: invalid JSON', "field 'x': unknown type"] },
    );
    expect(r.errors[0]).toBe('config: invalid JSON');
    expect(r.errors).toContainEqual(expect.stringContaining('card has no id'));
    expect(r.errors).not.toContainEqual(expect.stringContaining('unknown type'));
  });

  it('falls back to the caller-provided name when vault.name is empty', () => {
    const r = report(baseConfig({ vault: {} }), {}, { fallbackName: '/some/root' });
    expect(r.name).toBe('/some/root');
  });
});

describe('formatValidationReport — rendering', () => {
  it('renders a fixed report to the exact text both entry points print', () => {
    const r = report(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'priority: P1'),
      'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Active'),
    });
    const bar = '='.repeat(60);
    expect(formatValidationReport(r)).toBe(
      [
        `\n${bar}\nVAULT: Fixture  (specVersion 0.4, 2 cards)\n${bar}`,
        '\n  [Todo] (1)',
        '    T-1          P1 A',
        '\n  [Doing] (1)',
        '    T-2          -- B',
        '\n  [Done] (0)',
        '\n  OK — valid',
      ].join('\n'),
    );
  });

  it('renders hidden cards, warnings, and errors sections when present', () => {
    const fixed: ValidationReport = {
      name: 'V',
      specVersion: undefined,
      cardCount: 1,
      columns: ['Todo'],
      board: { Todo: [] },
      hidden: [
        { id: 'T-9', type: 'item', title: 'Lost', status: 'Gone', path: 'x.md', fields: {} },
      ],
      warnings: ['w1'],
      errors: ['e1'],
    };
    expect(formatValidationReport(fixed)).toBe(
      [
        `\n${'='.repeat(60)}\nVAULT: V  (specVersion ?, 1 cards)\n${'='.repeat(60)}`,
        '\n  [Todo] (0)',
        '\n  [hidden/off-board] (1)',
        '    T-9          Gone      Lost',
        '\n  WARNINGS (1, non-fatal):',
        '    ! w1',
        '\n  ERRORS (1):',
        '    x e1',
      ].join('\n'),
    );
  });

  it('marks a Blocked card and renders the parent pointer', () => {
    const fixed: ValidationReport = {
      name: 'V',
      specVersion: '0.4',
      cardCount: 1,
      columns: ['Todo'],
      board: {
        Todo: [
          {
            id: 'T-1',
            type: 'item',
            title: 'A',
            status: 'Blocked',
            path: 'x.md',
            priority: 'P2',
            fields: { parent: 'F-1' },
          },
        ],
      },
      hidden: [],
      warnings: [],
      errors: [],
    };
    expect(formatValidationReport(fixed)).toContain('    T-1          P2 A  ^F-1 *BLOCKED*');
  });
});
