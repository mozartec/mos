// validate-vault.test.mjs — pin the validator's contract (T-011).
//
// Zero dependencies: node's built-in runner only.
//   node --test scripts/validate-vault.test.mjs
//
// Every guarantee here was proven by throwaway temp-dir vaults during PR #49's
// review and re-proven by hand each round; this file makes them committed tests
// that fail the build on regression. Fixtures are self-contained — each defines
// its own types, columns, and areas in a temp dir (ADR-003); none assumes this
// repo's vocabulary, and none touches the live board/, which moves.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { validateVault } from './validate-vault.mjs';

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

// Build a throwaway vault under os.tmpdir(): write .mos/config.json and the given
// card files, return the root. Cleaned up after the suite.
function makeVault(config, files) {
  const root = mkdtempSync(join(tmpdir(), 'mos-validate-'));
  tmpDirs.push(root);
  mkdirSync(join(root, '.mos'), { recursive: true });
  writeFileSync(join(root, '.mos', 'config.json'), JSON.stringify(config, null, 2));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

// A generic config: three columns (so the column-before-last is a real in-flight
// column) and one parentless type. Overrides are shallow-merged, so a test that
// passes its own `fields`/`board`/`types` replaces the whole key.
function baseConfig(overrides = {}) {
  return {
    specVersion: '0.4',
    vault: { name: 'Fixture' },
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
    },
    board: { include: ['cards/**/*.md'], columns: ['Todo', 'Doing', 'Done'] },
    types: {
      item: { parent: null, states: { Open: 'Todo', Active: 'Doing', Closed: 'Done' } },
    },
    ...overrides,
  };
}

// Config whose `touches` is registered as a list-enum sourced from `areas`, with
// the given area names defined. The common "areas are configured" setup.
function withAreas(areaNames, extra = {}) {
  return baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      touches: { type: 'enum', source: 'areas', list: true },
    },
    areas: Object.fromEntries(areaNames.map((n) => [n, [`${n}/**`]])),
    ...extra,
  });
}

// Wrap frontmatter lines into a card body. Lines are written verbatim, so a test
// controls list syntax (inline / quoted / block) and key order precisely.
function card(...lines) {
  return `---\n${lines.join('\n')}\n---\n\n# card\n`;
}

const has = (list, substr) => list.some((m) => m.includes(substr));

// --- neither areas nor touches -------------------------------------------------

test('vault with neither areas nor touches: zero errors, zero warnings', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

// --- touches naming no configured area, in all three shapes --------------------

test('touches→no-area, areas configured (registered list-enum): error, valid value accepted', () => {
  const root = makeVault(withAreas(['alpha']), {
    'cards/ok.md': card('id: T-1', 'type: item', 'title: OK', 'status: Open', 'touches: [alpha]'),
    'cards/bad.md': card('id: T-2', 'type: item', 'title: Bad', 'status: Open', 'touches: [ghost]'),
  });
  const { errors } = validateVault(root);
  assert.ok(
    has(errors, "T-2: touches 'ghost' is not a value of config 'areas'"),
    errors.join('\n'),
  );
  assert.ok(!has(errors, 'T-1: touches'), errors.join('\n'));
});

test('touches→no-area, areas key missing but field registered: empty-set source flags every value', () => {
  // touches is registered (source: areas) but the config has no `areas` key.
  const config = baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      touches: { type: 'enum', source: 'areas', list: true },
    },
  });
  const root = makeVault(config, {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [alpha]'),
  });
  const { errors } = validateVault(root);
  // 'alpha' would be valid if areas existed; the empty-set source still flags it,
  // via the enum path (not the §5c fallback) — proving the check isn't skipped.
  assert.ok(
    has(errors, "T-1: touches 'alpha' is not a value of config 'areas'"),
    errors.join('\n'),
  );
  assert.ok(!has(errors, 'names no configured area'), errors.join('\n'));
});

test('touches→no-area, field unregistered and no areas: §5c fallback error', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [ghost]'),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, "T-1: touches 'ghost' names no configured area"), errors.join('\n'));
});

// --- list syntax: block, quoted-inline, unquoted-inline parse identically ------

test('valid touches parses identically inline, quoted-inline, and block', () => {
  const root = makeVault(withAreas(['alpha', 'beta']), {
    'cards/inline.md': card(
      'id: T-1',
      'type: item',
      'title: I',
      'status: Open',
      'touches: [alpha, beta]',
    ),
    'cards/quoted.md': card(
      'id: T-2',
      'type: item',
      'title: Q',
      'status: Open',
      'touches: ["alpha", "beta"]',
    ),
    'cards/block.md': card(
      'id: T-3',
      'type: item',
      'title: B',
      'status: Open',
      'touches:',
      '  - alpha',
      '  - beta',
    ),
  });
  const { errors } = validateVault(root);
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('a ghost area is flagged identically in inline, quoted, and block forms', () => {
  const root = makeVault(withAreas(['alpha']), {
    'cards/inline.md': card(
      'id: T-1',
      'type: item',
      'title: I',
      'status: Open',
      'touches: [ghost]',
    ),
    'cards/quoted.md': card(
      'id: T-2',
      'type: item',
      'title: Q',
      'status: Open',
      'touches: ["ghost"]',
    ),
    'cards/block.md': card(
      'id: T-3',
      'type: item',
      'title: B',
      'status: Open',
      'touches:',
      '  - ghost',
    ),
  });
  const { errors } = validateVault(root);
  for (const id of ['T-1', 'T-2', 'T-3'])
    assert.ok(
      has(errors, `${id}: touches 'ghost' is not a value of config 'areas'`),
      errors.join('\n'),
    );
});

test('duplicate touches entries are deduped: one error, not two', () => {
  const root = makeVault(withAreas(['alpha']), {
    'cards/a.md': card(
      'id: T-1',
      'type: item',
      'title: A',
      'status: Open',
      'touches: [ghost, ghost]',
    ),
  });
  const { errors } = validateVault(root);
  const ghost = errors.filter((e) => e.includes("touches 'ghost'"));
  assert.equal(ghost.length, 1, errors.join('\n'));
});

// --- block lists under scalar fields: clean diagnostics, no crash -------------

test('block list under scalar id: diagnosed as no-scalar-id, no crash', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('id:', '  - T-1', 'type: item', 'title: A', 'status: Open'),
  });
  let res;
  assert.doesNotThrow(() => {
    res = validateVault(root);
  });
  assert.ok(has(res.errors, 'card has no scalar id'), res.errors.join('\n'));
});

test('block list under scalar parent: diagnosed as not-a-single-id, no crash', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'parent:', '  - P-1'),
  });
  let res;
  assert.doesNotThrow(() => {
    res = validateVault(root);
  });
  assert.ok(has(res.errors, 'T-1: parent is not a single id'), res.errors.join('\n'));
});

test('block list under a scalar timestamp: diagnosed as non-UTC, no crash', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card(
      'id: T-1',
      'type: item',
      'title: A',
      'status: Open',
      'created:',
      '  - 2026-01-01T00:00:00Z',
    ),
  });
  let res;
  assert.doesNotThrow(() => {
    res = validateVault(root);
  });
  assert.ok(has(res.errors, 'T-1: created'), res.errors.join('\n'));
  assert.ok(has(res.errors, 'is not UTC ISO 8601'), res.errors.join('\n'));
});

// --- in-flight overlap: second-to-last column only ----------------------------

test('two in-flight cards with overlapping areas: warning names the pair and area', () => {
  const root = makeVault(withAreas(['alpha', 'beta']), {
    'cards/a.md': card(
      'id: T-1',
      'type: item',
      'title: A',
      'status: Active',
      'touches: [alpha, beta]',
    ),
    'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Active', 'touches: [alpha]'),
  });
  const { errors, warnings } = validateVault(root);
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.ok(
    has(warnings, "T-1 and T-2: both in 'Doing' and declare overlapping area(s): alpha"),
    warnings.join('\n'),
  );
});

test('overlap is exempt in the first and last columns', () => {
  const config = withAreas(['alpha']);
  const first = makeVault(config, {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [alpha]'),
    'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Open', 'touches: [alpha]'),
  });
  assert.deepEqual(validateVault(first).warnings, []);
  const last = makeVault(config, {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Closed', 'touches: [alpha]'),
    'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Closed', 'touches: [alpha]'),
  });
  assert.deepEqual(validateVault(last).warnings, []);
});

test('a two-column vault produces no overlap warnings (no in-flight column exists)', () => {
  const config = baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      touches: { type: 'enum', source: 'areas', list: true },
    },
    areas: { alpha: ['alpha/**'] },
    board: { include: ['cards/**/*.md'], columns: ['Todo', 'Done'] },
    types: { item: { parent: null, states: { Open: 'Todo', Closed: 'Done' } } },
  });
  const root = makeVault(config, {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'touches: [alpha]'),
    'cards/b.md': card('id: T-2', 'type: item', 'title: B', 'status: Open', 'touches: [alpha]'),
  });
  assert.deepEqual(validateVault(root).warnings, []);
});

// --- ids, timestamps, ordering ------------------------------------------------

test('unresolved dependsOn id: error', () => {
  const config = baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      dependsOn: { type: 'id', list: true },
    },
  });
  const root = makeVault(config, {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open', 'dependsOn: [T-999]'),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, "T-1: dependsOn 'T-999' does not resolve to a card"), errors.join('\n'));
});

test('duplicate id across cards: error', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('id: T-1', 'type: item', 'title: A', 'status: Open'),
    'cards/b.md': card('id: T-1', 'type: item', 'title: B', 'status: Open'),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, "duplicate id 'T-1'"), errors.join('\n'));
});

test('non-UTC timestamp: error', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card(
      'id: T-1',
      'type: item',
      'title: A',
      'status: Open',
      'created: 2026-01-01T00:00:00+02:00',
    ),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, 'T-1: created'), errors.join('\n'));
  assert.ok(has(errors, 'is not UTC ISO 8601'), errors.join('\n'));
});

test('frontmatter key order deviation: a warning, never an error', () => {
  const root = makeVault(baseConfig(), {
    'cards/a.md': card('title: A', 'id: T-1', 'type: item', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.ok(has(warnings, 'T-1: frontmatter keys out of order'), warnings.join('\n'));
  assert.deepEqual(errors, [], errors.join('\n'));
});
