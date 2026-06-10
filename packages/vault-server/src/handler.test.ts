import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVaultServer, type VaultServer } from './handler';

let vaultDir: string;
let server: VaultServer;

const get = (path: string) => server.fetch(new Request(`http://test${path}`));

beforeAll(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), 'mos-vault-server-'));
  await mkdir(join(vaultDir, '.mos'), { recursive: true });
  await mkdir(join(vaultDir, 'board'), { recursive: true });
  await writeFile(join(vaultDir, '.mos', 'config.json'), '{ "specVersion": "0.3" }');
  await writeFile(join(vaultDir, 'board', 'X-001-card.md'), '---\nid: X-001\n---\nbody');
  await writeFile(join(vaultDir, 'secret.txt'), 'not served');
  server = createVaultServer({ vaultDir });
});

afterAll(async () => {
  await server.close();
  await rm(vaultDir, { recursive: true, force: true });
});

describe('GET /vault/files', () => {
  it('lists markdown files and the vault config, nothing else', async () => {
    const res = await get('/vault/files');
    expect(res.status).toBe(200);
    const { files } = (await res.json()) as { files: string[] };
    expect(files).toEqual(['.mos/config.json', 'board/X-001-card.md']);
  });
});

describe('GET /vault/file', () => {
  it('serves an allowlisted file as text', async () => {
    const res = await get('/vault/file?path=board/X-001-card.md');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id: X-001');
  });

  it('requires the path parameter', async () => {
    expect((await get('/vault/file')).status).toBe(400);
  });

  it('blocks path traversal', async () => {
    expect((await get('/vault/file?path=../outside.md')).status).toBe(403);
  });

  it('does not serve files outside the allowlist', async () => {
    expect((await get('/vault/file?path=secret.txt')).status).toBe(404);
  });
});

describe('read-only surface', () => {
  it('rejects non-GET methods', async () => {
    const res = await server.fetch(
      new Request('http://test/vault/file?path=board/X-001-card.md', { method: 'POST' }),
    );
    expect(res.status).toBe(405);
  });

  it('404s unknown endpoints', async () => {
    expect((await get('/vault/nope')).status).toBe(404);
  });
});

describe('GET /vault/watch', () => {
  it('opens an SSE stream and confirms the connection', async () => {
    const res = await get('/vault/watch');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain(': connected');
    await reader.cancel();
  });
});
