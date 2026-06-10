import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findVault } from './find-vault';
import { startServer, type RunningServer } from './serve';

let root: string;
let vaultDir: string;
let webRoot: string;
let running: RunningServer;

const url = (path: string) => `http://127.0.0.1:${running.port}${path}`;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'mos-cli-'));
  vaultDir = join(root, 'erp');
  webRoot = join(root, 'web');
  await mkdir(join(vaultDir, '.mos'), { recursive: true });
  await mkdir(join(vaultDir, 'board'), { recursive: true });
  await mkdir(webRoot, { recursive: true });
  await writeFile(join(vaultDir, '.mos', 'config.json'), '{ "specVersion": "0.3" }');
  await writeFile(join(vaultDir, 'board', 'ERP-001-card.md'), '---\nid: ERP-001\n---\n');
  await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>mos</title>');
  await writeFile(join(webRoot, 'main.js'), 'console.log("app")');
  running = await startServer({ vaultDir, webRoot, port: 0 });
});

afterAll(async () => {
  await running.close();
  await rm(root, { recursive: true, force: true });
});

describe('findVault', () => {
  it('finds the nearest vault upward and null outside one', async () => {
    expect(findVault(join(vaultDir, 'board'))).toBe(vaultDir);
    expect(findVault(join(root, 'web'))).toBeNull();
  });
});

describe('one process, two surfaces', () => {
  it('serves the web app at /', async () => {
    const res = await fetch(url('/'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>mos</title>');
  });

  it('falls back to the app shell for SPA routes and serves assets by path', async () => {
    expect(await (await fetch(url('/board'))).text()).toContain('<title>mos</title>');
    const asset = await fetch(url('/main.js'));
    expect(asset.headers.get('Content-Type')).toContain('text/javascript');
  });

  it('serves the vault endpoints on the same origin', async () => {
    const res = await fetch(url('/vault/files'));
    const { files } = (await res.json()) as { files: string[] };
    expect(files).toEqual(['.mos/config.json', 'board/ERP-001-card.md']);

    const file = await fetch(url('/vault/file?path=board/ERP-001-card.md'));
    expect(await file.text()).toContain('id: ERP-001');
  });

  it('stays read-only: non-GET is rejected on both surfaces', async () => {
    expect((await fetch(url('/vault/files'), { method: 'POST' })).status).toBe(405);
    expect((await fetch(url('/'), { method: 'POST' })).status).toBe(405);
  });

  it('blocks path traversal on the static surface', async () => {
    const res = await fetch(url('/..%2f..%2fetc%2fpasswd'));
    expect([403, 404]).toContain(res.status);
    expect((await res.text()).includes('root:')).toBe(false);
  });
});
