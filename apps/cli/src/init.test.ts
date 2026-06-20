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
  it('scaffolds a config, the framework guide, an example card, and an agent guide in an empty folder', async () => {
    const result = initVault(dir);
    expect(result.created).toEqual([
      '.mos/config.json',
      '.mos/AGENTS.md',
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

  it('writes a portable framework guide at .mos/AGENTS.md that the root AGENTS.md references', async () => {
    initVault(dir);

    const guide = await readFile(join(dir, '.mos/AGENTS.md'), 'utf-8');
    // Owns "how to operate": lenses, the config-driven rule, areas/touches, write rules.
    expect(guide).toContain('# mos framework guide');
    expect(guide).toMatch(/## The three lenses/);
    expect(guide).toMatch(/Config drives all of it/);
    expect(guide).toMatch(/## Areas & touches/);
    // Versioning section covering the spec / CLI / skills axes.
    expect(guide).toMatch(/## Versioning/);
    expect(guide).toMatch(/Spec version/);
    expect(guide).toMatch(/CLI \/ app version/);
    expect(guide).toMatch(/Skills version/);
    // States the spec version it targets and points at the formal contract (no duplication).
    expect(guide).toContain('spec version 0.4');
    expect(guide).toMatch(/VAULT_SPEC/);
    // Portable: no reference to mos's own repo internals (ADRs, packages, the .agents setup).
    expect(guide).not.toMatch(/ADR-\d/);
    expect(guide).not.toMatch(/\.agents\//);
    expect(guide).not.toMatch(/packages\/core/);

    // The scaffolded root AGENTS.md points at the guide.
    const agents = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
    expect(agents).toContain('.mos/AGENTS.md');
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
    expect(result.created).toEqual(['.mos/config.json', '.mos/AGENTS.md']);
    expect(result.skipped).toEqual(['board/T-001-explore-the-board.md', 'AGENTS.md']);
    expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe('my own rules');
  });
});
