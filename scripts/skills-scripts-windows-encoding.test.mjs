// skills-scripts-windows-encoding.test.mjs — pin the T-028 Windows-portability fix.
//
// Run under Bun, matching the other script tests:
//   bun test scripts/skills-scripts-windows-encoding.test.mjs   # or: bun run test:scripts
//
// The three bundled skill scripts print non-ASCII glyphs (✓ ✗ → ← ℹ ⚠ ∅) to stdout.
// On a stock Windows console (cp1252) a plain print() of any of the seven crashing glyphs
// raises UnicodeEncodeError. Forcing PYTHONIOENCODING=cp1252 reproduces that exact failure
// on Linux/macOS, so this guard proxies the Windows console in CI: each script must run to
// exit 0 with no UnicodeEncodeError, and — because the fix reconfigures stdout to UTF-8 —
// the real glyph must still reach the output byte-for-byte (not stripped or mangled).
//
// It spawns the scripts against the shared eval fixture vaults; the mutating cases
// (--finish, a touches:[] card, an areas-less vault) run on disposable temp copies.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const NEXT = 'skills/mos-next-card/scripts/next_card.py';
const SHIP = 'skills/mos-ship-card/scripts/ship_card.py';
const REFINE = 'skills/mos-refine-batch/scripts/refine_batch.py';
const FIXTURE = 'skills/evals/fixture-vault';
const REFINE_FIXTURE = 'skills/evals/refine-fixture-vault';

// Pick an interpreter that resolves on this OS. On Windows `python`/`python3` are usually
// Microsoft Store stubs, so the `py` launcher comes first; on CI (Linux) `python3` is present.
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

// A broken-pipe check needs a POSIX shell with PIPESTATUS (to read the script's own exit
// code, not the consumer's) and `head`. That's CI Linux/macOS; on Windows it's skipped here
// and verified manually. Probe rather than assume.
function hasPosixPipe() {
  if (process.platform === 'win32') return false;
  const probe = spawnSync('bash', ['-c', 'head -c 0 </dev/null']);
  return !probe.error && probe.status === 0;
}

const PY = pickPython();
// If no interpreter resolves, the encoding cases can't run. Skip on a local dev box, but never
// let the guard go dark in CI: ubuntu-latest ships python3, so a missing interpreter there is a
// real failure, not a silent pass.
if (!PY && process.env.CI) {
  throw new Error(
    'skills-scripts-windows-encoding: no Python interpreter found in CI — the T-028 regression guard cannot run',
  );
}
if (!PY) console.warn('skills-scripts-windows-encoding: no Python interpreter found — skipping');
const t = PY ? test : test.skip;
const tpipe = PY && hasPosixPipe() ? test : test.skip;

const tmpDirs = [];
after(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

// Run a script with the console forced to cp1252 — the encoding that crashes on a stock
// Windows console. The fix must override it back to UTF-8 from inside the script.
function run(scriptRel, args) {
  return spawnSync(PY[0], [...PY.slice(1), join(REPO, scriptRel), ...args], {
    env: { ...process.env, PYTHONIOENCODING: 'cp1252' },
    encoding: 'utf8',
  });
}

function assertClean(label, r) {
  const all = (r.stdout || '') + (r.stderr || '');
  assert.ok(!/UnicodeEncodeError/.test(all), `${label}: UnicodeEncodeError raised\n${all}`);
  assert.equal(r.status, 0, `${label}: expected exit 0, got ${r.status}\n${all}`);
}

function copyFixture(srcRel) {
  const dest = mkdtempSync(join(tmpdir(), 'mos-enc-'));
  cpSync(join(REPO, srcRel), dest, { recursive: true });
  tmpDirs.push(dest);
  return dest;
}

function stripAreas(vaultDir) {
  const cfgPath = join(vaultDir, '.mos', 'config.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  delete cfg.areas;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

t('next_card.py default — recommendation arrow (→) survives cp1252', () => {
  const r = run(NEXT, [join(REPO, FIXTURE)]);
  assertClean('next_card default', r);
  assert.ok(r.stdout.includes('→'), 'expected the → RECOMMENDED glyph in output');
});

t('next_card.py --parallel — empty-set marker (∅) survives cp1252', () => {
  // A card that declares `touches: []` is what makes print_batch emit "∅ touches nothing".
  const vault = copyFixture(FIXTURE);
  const card = join(vault, 'board', 'JB-102-hello-page.md');
  writeFileSync(card, readFileSync(card, 'utf8').replace(/^touches:.*$/m, 'touches: []'));
  const r = run(NEXT, [vault, '--parallel', '5']);
  assertClean('next_card --parallel', r);
  assert.ok(r.stdout.includes('∅'), 'expected the ∅ touches-nothing glyph in output');
});

t('next_card.py --parallel on an areas-less vault — warning (⚠) survives cp1252', () => {
  const vault = copyFixture(FIXTURE);
  stripAreas(vault);
  const r = run(NEXT, [vault, '--parallel']);
  assertClean('next_card --parallel (no areas)', r);
  assert.ok(r.stdout.includes('⚠'), 'expected the ⚠ no-areas warning glyph in output');
});

t('ship_card.py pre-flight on a leaf card — check mark (✓) survives cp1252', () => {
  const r = run(SHIP, ['JB-102', join(REPO, FIXTURE)]);
  assertClean('ship_card pre-flight (leaf)', r);
  assert.ok(r.stdout.includes('✓'), 'expected a ✓ glyph in the pre-flight output');
});

t('ship_card.py pre-flight on a container card — info (ℹ) and cross (✗) survive cp1252', () => {
  const r = run(SHIP, ['EP-100', join(REPO, FIXTURE)]);
  assertClean('ship_card pre-flight (container)', r);
  assert.ok(r.stdout.includes('ℹ'), 'expected the ℹ container note glyph in output');
  assert.ok(r.stdout.includes('✗'), 'expected a ✗ open-child glyph in output');
});

t('ship_card.py --finish — writes the card AND exits 0 under cp1252 (Bug 1a)', () => {
  const vault = copyFixture(FIXTURE);
  const cardPath = join(vault, 'board', 'JB-102-hello-page.md');
  const r = run(SHIP, ['JB-102', vault, '--finish']);
  assertClean('ship_card --finish', r);
  const after = readFileSync(cardPath, 'utf8');
  // The mutation must land regardless of the cosmetic confirmation print: Shipped is the
  // state mapping to the fixture's last column, and the Acceptance box is ticked.
  assert.match(after, /^status:\s*Shipped\s*$/m, 'card status set to the Done state');
  assert.match(after, /- \[x\]/, 'Acceptance box ticked');
  assert.ok(!/- \[ \]/.test(after), 'no Acceptance box left unticked');

  // Idempotent re-run: still converges, still exits 0.
  const again = run(SHIP, ['JB-102', vault, '--finish']);
  assertClean('ship_card --finish (re-run)', again);
});

t('refine_batch.py default — hub arrow (←) survives cp1252', () => {
  const r = run(REFINE, [join(REPO, REFINE_FIXTURE)]);
  assertClean('refine_batch default', r);
  assert.ok(r.stdout.includes('←'), 'expected the ← possible HUB glyph in output');
});

t('refine_batch.py on an areas-less vault — warning (⚠) survives cp1252', () => {
  const vault = copyFixture(REFINE_FIXTURE);
  stripAreas(vault);
  const r = run(REFINE, [vault]);
  assertClean('refine_batch (no areas)', r);
  assert.ok(r.stdout.includes('⚠'), 'expected the ⚠ no-areas warning glyph in output');
});

// Bug 1a: a written card must exit 0 even when the cosmetic confirmation can't be delivered.
// `head -c 0` reads zero bytes then closes the read end, so ship_card's shutdown flush hits a
// broken pipe — the deferred failure that escapes a plain try/except around print() (pre-fix it
// forced exit 120 with the card already mutated). PIPESTATUS[0] is ship_card's own exit code,
// not head's. The spawnSync cases above fully consume stdout, so only this case exercises the
// closed-pipe path and the try/except swallow independently of the UTF-8 reconfigure.
tpipe(
  'ship_card.py --finish exits 0 with the card written even when stdout is a closed pipe',
  () => {
    const vault = copyFixture(FIXTURE);
    const cardPath = join(vault, 'board', 'JB-102-hello-page.md');
    const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
    const cmd =
      `${PY.map(q).join(' ')} ${q(join(REPO, SHIP))} JB-102 ${q(vault)} --finish | head -c 0; ` +
      `exit \${PIPESTATUS[0]}`;
    const r = spawnSync('bash', ['-c', cmd], {
      env: { ...process.env, PYTHONIOENCODING: 'cp1252' },
      encoding: 'utf8',
    });
    assert.equal(
      r.status,
      0,
      `expected exit 0 on a closed-pipe --finish, got ${r.status}\n${r.stderr}`,
    );
    const after = readFileSync(cardPath, 'utf8');
    assert.match(after, /^status:\s*Shipped\s*$/m, 'card written despite the closed pipe');
    assert.match(after, /- \[x\]/, 'Acceptance box ticked despite the closed pipe');
  },
);
