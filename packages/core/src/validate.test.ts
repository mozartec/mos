import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { buildModel } from './models.js';
import { parseFile } from './parse-file.js';
import { SUPPORTED_SPEC_VERSION, validateVault } from './validate.js';

// Drive the pure validator the way the I/O shell does: normalize a (partial)
// config with loadConfig, parse the card bodies, build the model, then validate.
// `paths` defaults to the card paths (enough for everything but area overlap,
// which the script-level contract suite covers end-to-end).
function run(
  configInput: unknown,
  cards: Record<string, string> = {},
  paths?: string[],
): { errors: string[]; warnings: string[] } {
  const { config } = loadConfig(JSON.stringify(configInput));
  const parsed = Object.entries(cards).map(([path, body]) => parseFile(path, body));
  const build = buildModel(parsed, config);
  return validateVault(build, config, paths ?? parsed.map((p) => p.path));
}

function card(...lines: string[]): string {
  return `---\n${lines.join('\n')}\n---\n\n# card\n`;
}

// A generic three-column vault (so there is a distinct in-flight column) with one
// parentless type. Overrides replace whole keys, matching loadConfig's shape.
function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    specVersion: '0.4',
    vault: { name: 'Fixture' },
    board: { include: ['cards/**/*.md'], columns: ['Todo', 'Doing', 'Done'] },
    types: { item: { parent: null, states: { Open: 'Todo', Active: 'Doing', Closed: 'Done' } } },
    ...overrides,
  };
}

// A scoped vault: an enum `sprint` field designated the board scope, given the
// supplied (possibly dated) values.
function scopedConfig(values: unknown[]): Record<string, unknown> {
  return baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      sprint: { type: 'enum', values },
    },
    board: { include: ['cards/**/*.md'], columns: ['Todo', 'Doing', 'Done'], scopeField: 'sprint' },
  });
}

describe('validateVault — spec version (§0)', () => {
  it('exposes the support claim it validates against', () => {
    expect(SUPPORTED_SPEC_VERSION).toBe('0.4');
  });

  it('warns (never errors) when the vault targets a newer spec version', () => {
    const { errors, warnings } = run(baseConfig({ specVersion: '0.5' }));
    expect(errors).toEqual([]);
    expect(warnings).toContainEqual(
      expect.stringContaining(`newer than the supported ${SUPPORTED_SPEC_VERSION}`),
    );
  });

  it('treats a higher major as newer', () => {
    expect(run(baseConfig({ specVersion: '1.0' })).warnings).toContainEqual(
      expect.stringContaining('newer than'),
    );
  });

  it('is silent when the spec version equals the supported one', () => {
    expect(run(baseConfig({ specVersion: SUPPORTED_SPEC_VERSION })).warnings).toEqual([]);
  });

  it('is silent for an older spec version (evolution is additive)', () => {
    expect(run(baseConfig({ specVersion: '0.2' })).warnings).toEqual([]);
  });

  it('is silent when the spec version is absent or unparseable (advisory only)', () => {
    expect(run(baseConfig({ specVersion: '' })).warnings).toEqual([]);
    expect(run(baseConfig({ specVersion: 'not-a-version' })).warnings).toEqual([]);
  });
});

describe('validateVault — board scope dates (§5d)', () => {
  it('accepts a well-formed dated scope: no errors, no warnings', () => {
    const { errors, warnings } = run(
      scopedConfig([
        { name: 'S1', starts: '2026-01-01', ends: '2026-01-14' },
        { name: 'S2', starts: '2026-01-15', ends: '2026-01-28' },
      ]),
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('flags a malformed ISO date as an error', () => {
    expect(run(scopedConfig([{ name: 'S1', starts: '2026-13-99' }])).errors).toContain(
      "board scope 'S1': starts '2026-13-99' is not a valid ISO date (YYYY-MM-DD)",
    );
  });

  it('flags an inverted window (starts after ends) as an error', () => {
    expect(
      run(scopedConfig([{ name: 'S1', starts: '2026-02-01', ends: '2026-01-01' }])).errors,
    ).toContain("board scope 'S1': starts '2026-02-01' is after ends '2026-01-01'");
  });

  it('warns (never errors) on overlapping windows', () => {
    const { errors, warnings } = run(
      scopedConfig([
        { name: 'S1', starts: '2026-01-01', ends: '2026-01-20' },
        { name: 'S2', starts: '2026-01-15', ends: '2026-01-28' },
      ]),
    );
    expect(errors).toEqual([]);
    expect(warnings).toContain("board scope 'S1' and 'S2' have overlapping dates");
  });

  it('flags a nameless or non-object scope value', () => {
    expect(run(scopedConfig([{ starts: '2026-01-01' }])).errors).toContain(
      'board scope: a value is missing a name',
    );
    expect(run(scopedConfig(['S1', 42])).errors).toContain(
      'board scope: value 42 must be a string or { name, starts?, ends? }',
    );
  });

  it('reads a 0.3 `sprints` key as the scope and validates its dates', () => {
    expect(run(baseConfig({ sprints: [{ name: 'S1', starts: '2026-13-01' }] })).errors).toContain(
      "board scope 'S1': starts '2026-13-01' is not a valid ISO date (YYYY-MM-DD)",
    );
  });

  it('leaves an unscoped vault clean', () => {
    const { errors, warnings } = run(baseConfig());
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe('validateVault — config shape (types)', () => {
  it('flags a state that maps to an unknown column', () => {
    const config = baseConfig({
      types: { item: { parent: null, states: { Open: 'Nope' } } },
    });
    expect(run(config).errors).toContain("type item: state 'Open' maps to unknown column 'Nope'");
  });

  it('flags parent nesting deeper than one level', () => {
    const config = baseConfig({
      types: {
        a: { parent: null, states: {} },
        b: { parent: 'a', states: {} },
        c: { parent: 'b', states: {} },
      },
    });
    expect(run(config).errors).toContain("type c: parent 'b' itself has a parent (nesting > 1)");
  });

  it('flags an undefined parent type', () => {
    const config = baseConfig({ types: { b: { parent: 'ghost', states: {} } } });
    expect(run(config).errors).toContain("type b: parent type 'ghost' is not defined");
  });
});

describe('validateVault — card identity diagnostics', () => {
  it('surfaces a duplicate id as an error', () => {
    const { errors } = run(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
      'cards/b.md': card('id: T-1', 'type: item', 'title: B', 'status: Open'),
    });
    expect(errors).toContainEqual(expect.stringContaining("duplicate id 'T-1'"));
  });

  it('surfaces a typed card with no id', () => {
    const { errors } = run(baseConfig(), {
      'cards/a.md': card('type: item', 'title: A', 'status: Open'),
    });
    expect(errors).toContainEqual(expect.stringContaining('card has no id'));
  });

  it('does not error on a board-scope file that simply is not a card', () => {
    const { errors } = run(baseConfig(), {
      'cards/readme.md': card('title: Not a card', 'status: whatever'),
    });
    expect(errors).toEqual([]);
  });
});

describe('validateVault — happy path & a card rule', () => {
  it('returns no diagnostics for a valid, in-order card', () => {
    const { errors, warnings } = run(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('flags a status not allowed for the card type', () => {
    const { errors } = run(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Nope'),
    });
    expect(errors).toContain("T-1: status 'Nope' not allowed for type 'item'");
  });
});

// A vault with id-list and area-sourced list-enum fields, for the list-entry and
// per-card rules below.
function listConfig(): Record<string, unknown> {
  return baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      created: { type: 'datetime' },
      dependsOn: { type: 'id', list: true },
      touches: { type: 'enum', source: 'areas', list: true },
    },
    areas: { core: ['core/**'] },
  });
}

describe('validateVault — list entries are coerced, not dropped (RISK A)', () => {
  it('flags a numeric dependsOn entry as unresolved (the old parser stringified it)', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'dependsOn: [123]'),
    });
    expect(errors).toContain("T-1: dependsOn '123' does not resolve to a card");
  });

  it('flags a numeric touches entry as no configured area', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [123]'),
    });
    expect(errors).toContain("T-1: touches '123' is not a value of config 'areas'");
  });

  it('still accepts a valid string list entry', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [core]'),
    });
    expect(errors).toEqual([]);
  });
});

describe('validateVault — malformed config never throws (RISK B)', () => {
  const noStates = () => baseConfig({ types: { item: { parent: null } } });

  it('reports a type with no states map instead of throwing', () => {
    expect(() => run(noStates())).not.toThrow();
    expect(run(noStates()).errors).toContain('type item: no states defined');
  });

  it('does not throw on a card whose type has no states map', () => {
    const cards = { 'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open') };
    expect(() => run(noStates(), cards)).not.toThrow();
    expect(run(noStates(), cards).errors).toContain('type item: no states defined');
  });
});

describe('validateVault — per-card rules (direct)', () => {
  it('flags a non-UTC timestamp', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card(
        'id: T-1',
        'type: item',
        'title: A',
        'status: Open',
        'created: 2026-01-01T00:00:00+02:00',
      ),
    });
    expect(errors).toContainEqual(expect.stringContaining('T-1: created'));
  });

  it('flags an unresolved dependsOn id', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'dependsOn: [T-99]'),
    });
    expect(errors).toContain("T-1: dependsOn 'T-99' does not resolve to a card");
  });

  it('flags a touches entry naming no configured area', () => {
    const { errors } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [ghost]'),
    });
    expect(errors).toContain("T-1: touches 'ghost' is not a value of config 'areas'");
  });

  it('warns on frontmatter keys out of order', () => {
    const { warnings } = run(listConfig(), {
      'cards/a.md': card('title: A', 'id: T-1', 'type: item', 'status: Open'),
    });
    expect(warnings).toContainEqual(expect.stringContaining('T-1: frontmatter keys out of order'));
  });

  it('warns when two in-flight cards declare overlapping areas', () => {
    const { warnings } = run(listConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Active', 'touches: [core]'),
      'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Active', 'touches: [core]'),
    });
    expect(warnings).toContainEqual(
      expect.stringContaining("both in 'Doing' and declare overlapping area(s): core"),
    );
  });
});

describe('validateVault — malformed / adversarial config never crashes', () => {
  it('skips a non-object field def instead of throwing (#1)', () => {
    const cfg = baseConfig({
      fields: { id: { type: 'id' }, estimate: null, dependsOn: { type: 'id', list: true } },
    });
    const cards = {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'dependsOn: [T-99]'),
    };
    // the null `estimate` def is skipped (no crash); the valid dependsOn check still fires.
    expect(() => run(cfg, cards)).not.toThrow();
    expect(run(cfg, cards).errors).toContain("T-1: dependsOn 'T-99' does not resolve to a card");
  });

  it('reports a null scopeField def as not registered, not a crash (#2)', () => {
    const cfg = baseConfig({
      fields: { sprint: null },
      board: {
        include: ['cards/**/*.md'],
        columns: ['Todo', 'Doing', 'Done'],
        scopeField: 'sprint',
      },
    });
    expect(() => run(cfg)).not.toThrow();
    expect(run(cfg).errors).toContain("board.scopeField: 'sprint' is not a registered field");
  });

  it('does not let a "not a card" filename swallow a real error (#4)', () => {
    const { errors } = run(baseConfig(), {
      'cards/why this is not a card.md': card('type: item', 'title: A', 'status: Open'),
    });
    expect(errors).toContainEqual(expect.stringContaining('card has no id'));
  });
});

describe('validateVault — prototype-safe lookups (#5)', () => {
  it('flags a __proto__ dependsOn id as unresolved', () => {
    const cfg = baseConfig({
      fields: { id: { type: 'id' }, dependsOn: { type: 'id', list: true } },
    });
    const { errors } = run(cfg, {
      'cards/a.md': card(
        'id: T-1',
        'type: item',
        'title: A',
        'status: Open',
        'dependsOn: ["__proto__"]',
      ),
    });
    expect(errors).toContain("T-1: dependsOn '__proto__' does not resolve to a card");
  });

  it('flags a prototype-key status as not allowed', () => {
    const { errors } = run(baseConfig(), {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: toString'),
    });
    expect(errors).toContain("T-1: status 'toString' not allowed for type 'item'");
  });

  it('flags a __proto__ parent as not found, not a prototype object', () => {
    const cfg = baseConfig({
      types: {
        feature: { parent: null, states: { Open: 'Todo', Active: 'Doing', Closed: 'Done' } },
        item: { parent: 'feature', states: { Open: 'Todo', Active: 'Doing', Closed: 'Done' } },
      },
    });
    const { errors } = run(cfg, {
      'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'parent: __proto__'),
    });
    expect(errors).toContain("T-1: parent '__proto__' not found");
  });
});
