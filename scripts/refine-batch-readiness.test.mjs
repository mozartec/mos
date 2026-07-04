// refine-batch-readiness.test.mjs — pin the F-033 config-declared readiness behavior.
//
// Run under Bun, matching the other script tests:
//   bun test scripts/refine-batch-readiness.test.mjs        # or: bun run test:scripts
//
// refine_batch.py used to hardcode one vault's six-section card template and flag a gap
// whenever the literal `## <Section>` was absent — a false positive on every vault with a
// different template. F-033 made readiness an opt-in, per-type `card.readiness` config list,
// matched flexibly, with an honest degrade when a type declares none. These tests run the
// script against the refine fixture (track/leg declare readiness; errand declares none) and
// disposable mutated copies, asserting the --json contract directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFINE = 'skills/mos-refine-batch/scripts/refine_batch.py';
const REFINE_FIXTURE = 'skills/evals/refine-fixture-vault';

function pickPython() {
  const candidates =
    process.platform === 'win32'
      ? [['py', '-3'], ['python'], ['python3']]
      : [['python3'], ['python'], ['py', '-3']];
  for (const c of candidates) {
    const probe = spawnSync(c[0], [...c.slice(1), '--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return c;
  }
  return null;
}

const PY = pickPython();
if (!PY && process.env.CI) {
  throw new Error(
    'refine-batch-readiness: no Python interpreter found in CI — the F-033 guard cannot run',
  );
}
if (!PY) console.warn('refine-batch-readiness: no Python interpreter found — skipping');
const t = PY ? test : test.skip;

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function copyFixture() {
  const dest = mkdtempSync(join(tmpdir(), 'mos-readiness-'));
  cpSync(join(REPO, REFINE_FIXTURE), dest, { recursive: true });
  tmpDirs.push(dest);
  return dest;
}

function run(vault, args = []) {
  return spawnSync(PY[0], [...PY.slice(1), join(REPO, REFINE), vault, ...args], {
    encoding: 'utf8',
  });
}

function runJson(vault) {
  const r = run(vault, ['--json']);
  assert.equal(r.status, 0, `refine_batch exited ${r.status}\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

const card = (j, id) => j.refinable.find((c) => c.id === id);

// Swap a card's body, keeping its frontmatter untouched. The fence match is `---\r?\n`
// (not `---\n`), mirroring refine_batch.py's parse_frontmatter: on a CRLF checkout
// (core.autocrlf=true) an LF-only anchor never matches and the replace silently no-ops.
function setBody(vault, file, body) {
  const path = join(vault, 'board', file);
  const text = readFileSync(path, 'utf8');
  writeFileSync(path, text.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)[\s\S]*$/, `$1\n${body}\n`));
}

// Drop `card.readiness` from every type — the no-readiness-declared vault.
function stripReadiness(vault) {
  const cfgPath = join(vault, '.mos', 'config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  for (const ty of Object.values(cfg.types)) if (ty.card) delete ty.card.readiness;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

// Set one type's `card.readiness` (array can hold non-strings — exercises the malformed case).
function setReadiness(vault, type, readiness) {
  const cfgPath = join(vault, '.mos', 'config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.types[type].card = { ...(cfg.types[type].card || {}), readiness };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

// missingSections for TR-200 after pointing track's readiness at `readiness` and setting its body.
function gapsFor(readiness, body) {
  const vault = copyFixture();
  setReadiness(vault, 'track', readiness);
  setBody(vault, 'TR-200-flights-search.md', body);
  return card(runJson(vault), 'TR-200').missingSections;
}

t('a complete card with mixed heading styles reports ZERO readiness gaps', () => {
  const vault = copyFixture();
  // track declares all six sections; write them in ATX, numbered, bold-label, and h3 forms —
  // the shapes an adopter's template might use — each with real content.
  setBody(
    vault,
    'TR-200-flights-search.md',
    [
      '## Outcome',
      'Users can search flights.',
      '',
      '## 2. Context — read before starting',
      '- `src/flights/` — the module.',
      '',
      '**Constraints (must honor):** read-only app surface.',
      '',
      '### Plan',
      '1. Build the module.',
      '',
      '## Acceptance',
      '- [ ] Search returns results.',
      '',
      '## Out of scope',
      'Booking.',
    ].join('\n'),
  );
  assert.deepEqual(card(runJson(vault), 'TR-200').missingSections, []);
});

t('a section heading with no content under it still counts as a gap', () => {
  const vault = copyFixture();
  setBody(
    vault,
    'TR-200-flights-search.md',
    [
      '## Outcome',
      'Users can search flights.',
      '## Context',
      'ctx',
      '## Constraints',
      'c',
      '## Plan',
      'p',
      '## Acceptance', // empty — immediately followed by the next heading
      '## Out of scope',
      'nothing',
    ].join('\n'),
  );
  assert.deepEqual(card(runJson(vault), 'TR-200').missingSections, ['Acceptance']);
});

t('a type that declares no readiness degrades to null, not fabricated gaps', () => {
  // errand declares no `card.readiness` in the fixture, so ER-300 must degrade as shipped.
  const er = card(runJson(join(REPO, REFINE_FIXTURE)), 'ER-300');
  assert.equal(er.readinessDeclared, false);
  assert.equal(er.missingSections, null);
});

t('text output prints the judge-by-reading note for an undeclared type', () => {
  const r = run(join(REPO, REFINE_FIXTURE));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /readiness: not declared for errand — judge by reading/);
});

t('a vault declaring no readiness anywhere still runs (passes 2-3) with all gaps null', () => {
  const vault = copyFixture();
  stripReadiness(vault);
  const j = runJson(vault);
  assert.ok(j.refinable.length > 0, 'still classifies refinable cards');
  for (const c of j.refinable) {
    assert.equal(c.readinessDeclared, false, `${c.id} should be undeclared`);
    assert.equal(c.missingSections, null, `${c.id} should have null gaps, not a fabricated list`);
  }
  // Pass 3 (surface overlap) is unaffected by readiness — the registry hub cluster still forms.
  assert.ok(j.overlapClusters.registry?.length >= 2, 'overlap clusters still computed');
});

t('dependsOn is read from frontmatter, not scraped from prose', () => {
  const vault = copyFixture();
  const path = join(vault, 'board', 'TR-202-cars-search.md');
  const text = readFileSync(path, 'utf8');
  // Add a frontmatter dependsOn; leave the body with no "depends on" prose at all.
  writeFileSync(path, text.replace(/^touches:.*$/m, 'dependsOn: [TR-200]\n$&'));
  assert.deepEqual(card(runJson(vault), 'TR-202').dependsOn, ['TR-200']);
});

t('explicit `dependsOn: []` wins over body prose (frontmatter is authoritative)', () => {
  const vault = copyFixture();
  const path = join(vault, 'board', 'TR-202-cars-search.md');
  const text = readFileSync(path, 'utf8');
  // Explicit empty list in frontmatter + a "depends on" sentence in the body.
  writeFileSync(
    path,
    text.replace(/^touches:.*$/m, 'dependsOn: []\n$&') + '\nThis depends on TR-200 for setup.\n',
  );
  assert.deepEqual(card(runJson(vault), 'TR-202').dependsOn, []);
});

// --- review findings: the flexible matcher must not mis-read common markdown shapes ---

t('content under a deeper `###` subsection counts (not a false gap)', () => {
  assert.deepEqual(gapsFor(['Plan'], '## Plan\n### Step 1\ndo it'), []);
});

t('a bold lead-in (`**Note:**`) is content, not the next section', () => {
  assert.deepEqual(gapsFor(['Context'], '## Context\n**Note:** important.\nmore context'), []);
});

t('a hyphenated distinct heading does NOT satisfy a readiness name', () => {
  // `## Plan-of-record` must not be read as the `Plan` section — that would hide a real gap.
  assert.deepEqual(gapsFor(['Plan'], '## Plan-of-record\nx'), ['Plan']);
});

t('closed ATX (`## Plan ##`) and emphasized (`## **Plan**`) titles are recognized', () => {
  assert.deepEqual(gapsFor(['Plan'], '## Plan ##\nreal content'), []);
  assert.deepEqual(gapsFor(['Plan'], '## **Plan**\nreal content'), []);
});

t('a heading inside a ``` fence does not count as a section', () => {
  assert.deepEqual(gapsFor(['Plan'], '## Acceptance\n```\n## Plan\nx\n```'), ['Plan']);
});

t('a malformed readiness entry (non-string) is skipped, not crashed', () => {
  // ["Plan", 42] must not abort the run; valid entries are still evaluated.
  assert.deepEqual(gapsFor(['Plan', 42], '## Plan\nreal content'), []);
});
