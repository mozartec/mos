import { describe, expect, it } from 'vitest';
import { loadConfig, orderFrontmatter } from './config.js';

/** A well-formed config mirroring this repo's `.mos/config.json` (the happy path). */
function validConfig() {
  return {
    specVersion: '0.2',
    vault: { name: 'Test Vault' },
    meta: { timestamps: { createdField: 'created', updatedField: 'updated' } },
    fields: {
      priority: { type: 'enum', values: ['P0', 'P1'], label: 'Priority' },
      sprint: { type: 'enum', source: 'sprints' },
      owner: { type: 'string' },
      created: { type: 'datetime' },
    },
    wiki: { include: ['**/*.md'], exclude: ['.mos/**'], fields: ['created'] },
    board: {
      include: ['board/**/*.md'],
      columns: ['Backlog', 'Planned', 'In Progress', 'Done'],
      sortWithinColumn: ['priority', 'id'],
    },
    references: { idPattern: '[A-Z]-\\d{3}' },
    types: {
      feature: {
        label: 'Feature',
        parent: null,
        states: { Planned: 'Planned', 'In Progress': 'In Progress', Done: 'Done' },
      },
      story: {
        label: 'Story',
        parent: 'feature',
        states: { Planned: 'Planned', Blocked: 'In Progress', Deferred: null },
      },
    },
    sprints: ['S1', 'S2'],
  };
}

describe('loadConfig', () => {
  // ── happy path ───────────────────────────────────────────────────────────

  describe('valid config', () => {
    it('accepts a well-formed config with no errors', () => {
      const { config, errors } = loadConfig(validConfig());
      expect(errors).toEqual([]);
      expect(config.vault.name).toBe('Test Vault');
      expect(config.board.columns).toEqual(['Backlog', 'Planned', 'In Progress', 'Done']);
      expect(config.types['story']?.parent).toBe('feature');
    });

    it('parses an equivalent JSON string identically to the object form', () => {
      const fromObject = loadConfig(validConfig());
      const fromString = loadConfig(JSON.stringify(validConfig()));
      expect(fromString).toEqual(fromObject);
    });

    it('accepts a state that maps to null (hidden from the board)', () => {
      const { errors } = loadConfig(validConfig());
      expect(errors).toEqual([]);
    });

    it('accepts an enum field sourced from a resolvable config list', () => {
      const { errors } = loadConfig(validConfig());
      expect(errors).toEqual([]); // sprint -> source: "sprints"
    });
  });

  // ── defaults ─────────────────────────────────────────────────────────────

  describe('defaults for absent optional keys', () => {
    it('fills documented defaults when optional keys are missing', () => {
      const { config, errors } = loadConfig({
        specVersion: '0.2',
        vault: { name: 'Minimal' },
        board: { include: [], columns: ['Todo', 'Done'] },
        types: {},
      });
      expect(errors).toEqual([]);
      expect(config.board.sortWithinColumn).toEqual(['priority', 'id']);
      expect(config.wiki.exclude).toEqual([]);
      expect(config.sprints).toEqual([]);
      expect(config.areas).toEqual({});
      expect(config.fields).toEqual({});
      expect(config.meta.timestamps).toEqual({
        createdField: 'created',
        updatedField: 'updated',
      });
      expect(config.references.idPattern).toBe('[A-Z][A-Z0-9]*-[0-9]+(?:-[A-Z]+-[0-9]+)*');
    });

    it('respects a custom meta.timestamps mapping when present', () => {
      const cfg = validConfig();
      cfg.meta.timestamps = { createdField: 'added', updatedField: 'modified' };
      const { config } = loadConfig(cfg);
      expect(config.meta.timestamps).toEqual({
        createdField: 'added',
        updatedField: 'modified',
      });
    });
  });

  // ── malformed input ──────────────────────────────────────────────────────

  describe('malformed input', () => {
    it('reports bad JSON and never throws', () => {
      const result = loadConfig('{ not valid json');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/^config: invalid JSON/);
      expect(() => loadConfig('{ not valid json')).not.toThrow();
    });

    it('reports a non-object top-level value', () => {
      const result = loadConfig('[]');
      expect(result.errors[0]).toMatch(/^config: expected a JSON object/);
    });
  });

  // ── validation rules ─────────────────────────────────────────────────────
  // Each case is a focused object literal — loadConfig accepts `object`, so no
  // casts are needed and missing keys fall back to their defaults.

  describe('validation', () => {
    it('rejects a state that maps to a column not in board.columns', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { feature: { parent: null, states: { Planned: 'Nonexistent' } } },
      });
      expect(errors.some((e) => /unknown column 'Nonexistent'/.test(e))).toBe(true);
    });

    it('rejects a parent type that is not defined', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { story: { parent: 'ghost', states: { Done: 'Done' } } },
      });
      expect(errors.some((e) => /parent type 'ghost' is not defined/.test(e))).toBe(true);
    });

    it('rejects nesting deeper than one level (parent of a parent)', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: {
          grandparent: { parent: null, states: { Done: 'Done' } },
          feature: { parent: 'grandparent', states: { Done: 'Done' } },
          story: { parent: 'feature', states: { Done: 'Done' } },
        },
      });
      expect(errors.some((e) => /parent 'feature' itself has a parent/.test(e))).toBe(true);
    });

    it('rejects an unknown field type', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { weird: { type: 'colour' } },
      });
      expect(errors.some((e) => /field weird: unknown type 'colour'/.test(e))).toBe(true);
    });

    it('rejects an enum field with neither values nor source', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { loose: { type: 'enum' } },
      });
      expect(errors.some((e) => /field loose: enum needs 'values' or 'source'/.test(e))).toBe(true);
    });

    it('rejects an enum field whose source does not resolve to a config list', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { bad: { type: 'enum', source: 'doesNotExist' } },
      });
      expect(errors.some((e) => /enum source 'doesNotExist' does not resolve/.test(e))).toBe(true);
    });

    it('accepts an enum field sourced from a config map (its keys are the values)', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        areas: { web: ['apps/web/**'] },
        fields: { touches: { type: 'enum', source: 'areas', list: true } },
      });
      expect(errors).toEqual([]);
    });

    it('rejects an enum source that only resolves via the prototype chain', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { sneaky: { type: 'enum', source: '__proto__' } },
      });
      expect(errors.some((e) => /enum source '__proto__' does not resolve/.test(e))).toBe(true);
    });

    it('rejects a parent type that exists only on the prototype chain', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { story: { parent: 'constructor', states: { Done: 'Done' } } },
      });
      expect(errors.some((e) => /parent type 'constructor' is not defined/.test(e))).toBe(true);
    });

    it('rejects an area whose value is not a list of glob strings', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        areas: { web: ['apps/web/**'], broken: 'apps/web/**' },
      });
      expect(errors.some((e) => /area broken: expected a list of glob strings/.test(e))).toBe(true);
    });

    it('rejects an invalid references.idPattern regex', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        references: { idPattern: '[' },
      });
      expect(errors.some((e) => /references\.idPattern: invalid regex/.test(e))).toBe(true);
    });

    it('accepts a type color and field icon/valueColors from the curated sets', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { feature: { parent: null, color: 'purple', states: { Done: 'Done' } } },
        fields: {
          priority: {
            type: 'enum',
            values: ['P0', 'P1'],
            icon: 'flag',
            valueColors: { P0: 'red', P1: 'amber' },
          },
        },
      });
      expect(errors).toEqual([]);
    });

    it('rejects a type color outside the palette', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { feature: { parent: null, color: 'fuchsia', states: { Done: 'Done' } } },
      });
      expect(errors.some((e) => /type feature: unknown color 'fuchsia'/.test(e))).toBe(true);
    });

    it('rejects a field icon outside the curated set', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { owner: { type: 'string', icon: 'rocket' } },
      });
      expect(errors.some((e) => /field owner: unknown icon 'rocket'/.test(e))).toBe(true);
    });

    it('rejects a valueColors entry outside the palette', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        fields: { priority: { type: 'enum', values: ['P0'], valueColors: { P0: 'crimson' } } },
      });
      expect(errors.some((e) => /value 'P0' has unknown color 'crimson'/.test(e))).toBe(true);
    });

    it('collects multiple errors without throwing', () => {
      const { errors } = loadConfig({
        board: { columns: ['Done'] },
        types: { story: { parent: 'ghost', states: { Done: 'Done' } } },
        fields: { weird: { type: 'colour' } },
      });
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('fieldOrder (F-013)', () => {
  it('defaults to the shipped canonical order when absent', () => {
    const { config } = loadConfig('{}');
    expect(config.fieldOrder).toEqual([
      'id',
      'type',
      'title',
      'status',
      'priority',
      'phase',
      'owner',
      'sprint',
      'parent',
      'estimate',
      'dependsOn',
      'touches',
      'created',
      'updated',
    ]);
  });

  it('honors an explicit fieldOrder from config', () => {
    const { config, errors } = loadConfig({ fieldOrder: ['id', 'title', 'status'] });
    expect(errors).toEqual([]);
    expect(config.fieldOrder).toEqual(['id', 'title', 'status']);
  });
});

describe('orderFrontmatter (F-013)', () => {
  it('reorders keys to the given order, unlisted keys after in original order', () => {
    const ordered = orderFrontmatter(
      { custom: 1, status: 'Todo', id: 'T-001', extra: 2, title: 'x' },
      ['id', 'title', 'status'],
    );
    expect(Object.keys(ordered)).toEqual(['id', 'title', 'status', 'custom', 'extra']);
  });

  it('returns a new object and keeps all values', () => {
    const data = { id: 'T-001', status: 'Todo' };
    const ordered = orderFrontmatter(data, ['status', 'id']);
    expect(ordered).not.toBe(data);
    expect(ordered).toEqual({ status: 'Todo', id: 'T-001' });
  });

  it('ignores order entries missing from the data', () => {
    expect(Object.keys(orderFrontmatter({ id: 'T-001' }, ['title', 'id']))).toEqual(['id']);
  });
});
