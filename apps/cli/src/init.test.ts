import { beforeEach, afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initVault, InitRefusedError } from './init';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mos-init-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('initVault', () => {
  it('scaffolds a config, an example card, and an agent guide in an empty folder', async () => {
    const result = initVault(dir);
    expect(result.created).toEqual([
      '.mos/config.json',
      'board/T-001-explore-the-board.md',
      'AGENTS.md',
    ]);
    expect(result.skipped).toEqual([]);

    const config = JSON.parse(await readFile(join(dir, '.mos/config.json'), 'utf-8')) as {
      specVersion: string;
      types: Record<string, { states: Record<string, string | null> }>;
      board: { columns: string[] };
    };
    expect(config.specVersion).toBe('0.4');
    expect(Object.keys(config.types)).toEqual(['feature', 'task']);
    // Every state maps to a configured column (or null = hidden).
    for (const type of Object.values(config.types)) {
      for (const column of Object.values(type.states)) {
        if (column !== null) expect(config.board.columns).toContain(column);
      }
    }

    const card = await readFile(join(dir, 'board/T-001-explore-the-board.md'), 'utf-8');
    expect(card).toMatch(/^---\nid: T-001\ntype: task\n/);
    expect(card).toContain('## Acceptance');
    expect(card).toMatch(/created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  });

  it('refuses to touch an existing vault', async () => {
    initVault(dir);
    expect(() => initVault(dir)).toThrow(InitRefusedError);
  });

  it('skips files that already exist instead of overwriting', async () => {
    await writeFile(join(dir, 'AGENTS.md'), 'my own rules');
    await mkdir(join(dir, 'board'));
    await writeFile(join(dir, 'board/T-001-explore-the-board.md'), 'mine');

    const result = initVault(dir);
    expect(result.created).toEqual(['.mos/config.json']);
    expect(result.skipped).toEqual(['board/T-001-explore-the-board.md', 'AGENTS.md']);
    expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe('my own rules');
  });
});
