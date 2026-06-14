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
// the given area names defined (each glob conventionally `<name>/**`). The common
// "areas are configured" setup; delegates to withAreaGlobs for the shared wiring.
function withAreas(areaNames, extra = {}) {
  return withAreaGlobs(Object.fromEntries(areaNames.map((n) => [n, [`${n}/**`]])), extra);
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

// --- area glob overlap (§5c) --------------------------------------------------

// A config whose areas are given verbatim (each value a glob list), with touches
// registered as a list-enum sourced from them — the §5c setup, but with control
// over the globs so a test can make two areas collide. The base for withAreas.
function withAreaGlobs(areas, extra = {}) {
  return baseConfig({
    fields: {
      id: { type: 'id' },
      title: { type: 'string' },
      status: { type: 'string' },
      touches: { type: 'enum', source: 'areas', list: true },
    },
    areas,
    ...extra,
  });
}

test('two areas matching a shared file: one warning names both areas and a sample path', () => {
  const root = makeVault(withAreaGlobs({ web: ['apps/**'], app: ['apps/web/**'] }), {
    // Both files are matched by web (apps/**) and app (apps/web/**): a many-file
    // overlap that must collapse to a single line, not one per file.
    'apps/web/a.ts': 'a',
    'apps/web/b.ts': 'b',
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.deepEqual(errors, [], errors.join('\n'));
  const overlap = warnings.filter((w) => w.includes('have overlapping globs'));
  assert.equal(overlap.length, 1, overlap.join('\n'));
  assert.ok(overlap[0].includes("'app'") && overlap[0].includes("'web'"), overlap[0]);
  assert.ok(overlap[0].includes('apps/web/a.ts'), overlap[0]); // smallest matched path
});

test('multiple independent overlapping pairs: one line each, emitted in sorted order', () => {
  // Two disjoint collisions — z1/z2 over z/**, a1/a2 over a/** — so the only thing
  // under test is the final sort of the pair keys (independent of which file the
  // walk visits first). 'a1' sorts before 'z1', so its line comes first.
  const root = makeVault(
    withAreaGlobs({ z1: ['z/**'], z2: ['z/**'], a1: ['a/**'], a2: ['a/**'] }),
    {
      'z/f.ts': 'z',
      'a/f.ts': 'a',
      'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
    },
  );
  const { errors, warnings } = validateVault(root);
  assert.deepEqual(errors, [], errors.join('\n'));
  const overlap = warnings.filter((w) => w.includes('have overlapping globs'));
  assert.equal(overlap.length, 2, overlap.join('\n'));
  assert.ok(overlap[0].includes("'a1'") && overlap[0].includes("'a2'"), overlap[0]);
  assert.ok(overlap[1].includes("'z1'") && overlap[1].includes("'z2'"), overlap[1]);
});

test('disjoint areas: no overlap warning, no new error', () => {
  const root = makeVault(withAreaGlobs({ core: ['core/**'], web: ['web/**'] }), {
    'core/a.ts': 'a',
    'web/b.ts': 'b',
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.ok(!has(warnings, 'overlapping globs'), warnings.join('\n'));
  assert.deepEqual(errors, [], errors.join('\n')); // exit code unchanged
});

test('a single area cannot overlap: no warning even when it matches many files', () => {
  const root = makeVault(withAreaGlobs({ web: ['apps/**', 'apps/web/**'] }), {
    'apps/web/a.ts': 'a',
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.ok(!has(warnings, 'overlapping globs'), warnings.join('\n'));
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('empty areas map, and a vault with no areas: no overlap warning, no new error', () => {
  const empty = validateVault(
    makeVault(withAreaGlobs({}), {
      'apps/web/a.ts': 'a',
      'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
    }),
  );
  assert.ok(!has(empty.warnings, 'overlapping globs'), empty.warnings.join('\n'));
  assert.deepEqual(empty.errors, [], empty.errors.join('\n'));
  const none = validateVault(
    makeVault(baseConfig(), {
      'apps/web/a.ts': 'a',
      'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
    }),
  );
  assert.ok(!has(none.warnings, 'overlapping globs'), none.warnings.join('\n'));
  assert.deepEqual(none.errors, [], none.errors.join('\n'));
});

// --- area definition shape (§5c, T-016): each area is a list of glob strings ---

test('area whose value is not an array: error names the area and the value', () => {
  const root = makeVault(withAreaGlobs({ web: 'apps/web/**' }), {
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors } = validateVault(root);
  assert.ok(
    has(errors, `area 'web': definition must be a list of glob strings, got "apps/web/**"`),
    errors.join('\n'),
  );
});

test('area array with a non-string entry: error names the area and the offending value', () => {
  const root = makeVault(withAreaGlobs({ web: ['apps/web/**', 42] }), {
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, "area 'web': glob 42 is not a string"), errors.join('\n'));
});

test('shape check fires for a single malformed area, independent of the ≥2-area overlap check', () => {
  // One area, so validateAreaOverlap returns before mapping paths — yet the shape
  // error is still raised, proving the two checks are independent.
  const root = makeVault(withAreaGlobs({ web: 42 }), {
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.ok(
    has(errors, "area 'web': definition must be a list of glob strings"),
    errors.join('\n'),
  );
  assert.ok(!has(warnings, 'overlapping globs'), warnings.join('\n'));
});

test('every malformed entry in one area is named, not just the first', () => {
  const root = makeVault(withAreaGlobs({ web: [1, 'ok', 2] }), {
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors } = validateVault(root);
  assert.ok(has(errors, "area 'web': glob 1 is not a string"), errors.join('\n'));
  assert.ok(has(errors, "area 'web': glob 2 is not a string"), errors.join('\n'));
});

test('well-formed areas: no shape error and no new warning', () => {
  const root = makeVault(withAreaGlobs({ core: ['core/**'], web: ['web/**'] }), {
    'core/a.ts': 'a',
    'web/b.ts': 'b',
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors, warnings } = validateVault(root);
  assert.deepEqual(errors, [], errors.join('\n'));
  assert.deepEqual(warnings, [], warnings.join('\n'));
});

test('vault with no areas: no shape error', () => {
  const root = makeVault(baseConfig(), {
    'cards/c.md': card('id: T-1', 'type: item', 'title: C', 'status: Open'),
  });
  const { errors } = validateVault(root);
  assert.ok(!has(errors, 'area '), errors.join('\n'));
  assert.deepEqual(errors, [], errors.join('\n'));
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
