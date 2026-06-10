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
  await mkdir(join(vaultDir, '.hidden'), { recursive: true });
  await mkdir(join(vaultDir, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(vaultDir, '.hidden', 'note.md'), 'hidden md');
  await writeFile(join(vaultDir, 'node_modules', 'pkg', 'README.md'), 'dependency md');
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

  it('serves exactly what /vault/files lists — no hidden-dir or node_modules markdown', async () => {
    const { files } = (await (await get('/vault/files')).json()) as { files: string[] };
    expect(files).toEqual(['.mos/config.json', 'board/X-001-card.md']);
    expect((await get('/vault/file?path=.hidden/note.md')).status).toBe(404);
    expect((await get('/vault/file?path=node_modules/pkg/README.md')).status).toBe(404);
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

  it('reports changes inside the watch scope and stays silent outside it', async () => {
    const res = await get('/vault/watch');
    const reader = res.body!.getReader();
    await reader.read(); // ': connected'

    // Outside the watch scope (vault root is not in the board/docs allowlist),
    // then inside it. Only the board edit must produce an event.
    await writeFile(join(vaultDir, 'unwatched-note.md'), '# outside the watch scope');
    await new Promise((r) => setTimeout(r, 50));
    await writeFile(join(vaultDir, 'board', 'X-001-card.md'), '---\nid: X-001\n---\nedited');

    const { value } = await reader.read();
    const events = new TextDecoder().decode(value);
    expect(events).toContain('board/X-001-card.md');
    expect(events).not.toContain('unwatched-note.md');
    await reader.cancel();
  });

  it('keeps broadcasting to live clients after another client disconnects', async () => {
    const first = (await get('/vault/watch')).body!.getReader();
    const second = (await get('/vault/watch')).body!.getReader();
    await first.read(); // ': connected'
    await second.read();

    await first.cancel();
    await writeFile(join(vaultDir, 'board', 'X-001-card.md'), '---\nid: X-001\n---\nedited twice');

    const { value } = await second.read();
    expect(new TextDecoder().decode(value)).toContain('board/X-001-card.md');
    await second.cancel();
  });
});
