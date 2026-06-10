// Pack-and-install smoke test (T-008): prove the *published artifact* works,
// not the workspace. Packs the CLI with `npm pack`, installs the tarball into
// a clean temp project, scaffolds a vault with `mos init`, serves it with
// `mos serve`, and probes the running server — the page, the vault endpoints,
// a live SSE event, and the read-only 405. Plain Node ≥ 20, no test runner,
// so it exercises exactly what a consumer gets.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`[smoke] FAIL: ${message}`);
  process.exitCode = 1;
  cleanup();
  process.exit(1);
}

function ok(message) {
  console.log(`[smoke] ok: ${message}`);
}

if (!existsSync(join(cliDir, 'dist/main.js')) || !existsSync(join(cliDir, 'dist/web/index.html'))) {
  fail('dist/ is missing or incomplete — build first: bunx turbo run build --filter=@mozartec/mos-cli');
}

const workDir = mkdtempSync(join(tmpdir(), 'mos-smoke-'));
let server;

function cleanup() {
  if (server && !server.killed) server.kill('SIGTERM');
  rmSync(workDir, { recursive: true, force: true });
}
process.on('exit', cleanup);

// 1. Pack the tarball — this is the artifact `npm publish` would upload.
const packOutput = execFileSync('npm', ['pack', '--pack-destination', workDir], {
  cwd: cliDir,
  encoding: 'utf-8',
});
const tarball = join(workDir, packOutput.trim().split('\n').at(-1));
if (!existsSync(tarball)) fail(`npm pack did not produce ${tarball}`);
ok(`packed ${tarball}`);

// 2. Install it in a clean consumer project (no workspace, no repo).
const consumerDir = join(workDir, 'consumer');
writeFileSync(join(workDir, 'package.json'), JSON.stringify({ name: 'mos-smoke-consumer', private: true }));
execFileSync('npm', ['install', tarball], { cwd: workDir, encoding: 'utf-8' });
const mosBin = join(workDir, 'node_modules', '.bin', 'mos');
if (!existsSync(mosBin)) fail('installed package exposes no `mos` bin');
ok('tarball installed, `mos` bin present');

// 3. `mos init` scaffolds a vault.
const initOutput = execFileSync('node', [mosBin, 'init', consumerDir], { encoding: 'utf-8' });
if (!existsSync(join(consumerDir, '.mos/config.json'))) fail('mos init created no .mos/config.json');
if (!initOutput.includes('vault scaffolded')) fail('mos init did not report success');
ok('mos init scaffolded a vault');

// 4. `mos serve --port 0` — parse the bound port from its own output.
server = spawn('node', [mosBin, 'serve', consumerDir, '--port', '0'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const port = await new Promise((resolve, reject) => {
  let out = '';
  const timer = setTimeout(() => reject(new Error(`mos serve never reported a port:\n${out}`)), 15000);
  server.stdout.on('data', (chunk) => {
    out += String(chunk);
    const match = out.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
  server.on('exit', (code) => reject(new Error(`mos serve exited early (${code}):\n${out}`)));
}).catch((err) => fail(err.message));
ok(`mos serve is up on port ${port}`);
const base = `http://127.0.0.1:${port}`;

// 5. Probe the surfaces.
const page = await fetch(`${base}/`);
const pageText = await page.text();
if (page.status !== 200 || !pageText.includes('<app-root')) fail('GET / did not serve the web app');
if (!pageText.includes('<title>mos</title>')) fail('served page <title> is not "mos"');
ok('GET / serves the web app, titled "mos"');

const files = await fetch(`${base}/vault/files`);
const fileList = (await files.json()).files;
if (files.status !== 200 || !fileList.some((f) => f.includes('T-001'))) {
  fail('/vault/files does not list the scaffolded card');
}
ok('/vault/files lists the vault');

const licenses = await fetch(`${base}/3rdpartylicenses.txt`);
if (licenses.status !== 200) fail('3rdpartylicenses.txt is not in the package');
ok('third-party licenses ship in the package');

const post = await fetch(`${base}/vault/files`, { method: 'POST' });
if (post.status !== 405) fail(`POST /vault/files returned ${post.status}, want 405 (read-only)`);
ok('non-GET is rejected with 405');

// 6. SSE: a vault edit must reach a connected watcher.
const sse = await fetch(`${base}/vault/watch`);
if (sse.headers.get('content-type') !== 'text/event-stream') fail('/vault/watch is not an SSE stream');
const reader = sse.body.getReader();
await reader.read(); // ': connected'
const cardPath = join(consumerDir, 'board/T-001-explore-the-board.md');
appendFileSync(cardPath, '\nsmoke-test touch\n');
let sseTimer;
const sseEvent = await Promise.race([
  reader.read().then(({ value }) => new TextDecoder().decode(value)),
  new Promise((_, reject) => {
    sseTimer = setTimeout(() => reject(new Error('no SSE event within 10s of a vault edit')), 10000);
  }),
]).catch((err) => fail(err.message));
clearTimeout(sseTimer);
if (!sseEvent.includes('T-001')) fail(`SSE event does not name the edited card: ${sseEvent}`);
await reader.cancel();
ok('SSE watcher reported the vault edit');

// 7. EADDRINUSE is a one-line human error, not a stack trace.
const clash = spawn('node', [mosBin, 'serve', consumerDir, '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const clashResult = await new Promise((resolve) => {
  let err = '';
  clash.stderr.on('data', (chunk) => (err += String(chunk)));
  clash.on('exit', (code) => resolve({ code, err }));
});
if (clashResult.code !== 1 || !clashResult.err.includes('already in use')) {
  fail(`port clash: exit ${clashResult.code}, stderr: ${clashResult.err}`);
}
if (clashResult.err.trim().split('\n').length !== 1) {
  fail(`port clash should print one line, got:\n${clashResult.err}`);
}
ok('EADDRINUSE produces a one-line error');

console.log('[smoke] PASS — packed artifact installs, inits, serves, watches, stays read-only');
