import { afterAll, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { discoverVaults, runValidate } from './validate';

const tmpRoots: string[] = [];

afterAll(async () => {
  await Promise.all(tmpRoots.map((r) => rm(r, { recursive: true, force: true })));
});

const CONFIG = JSON.stringify({
  specVersion: '0.4',
  vault: { name: 'Fixture' },
  board: { include: ['board/**/*.md'], columns: ['Todo', 'Done'] },
  references: { idPattern: '[A-Z]+-[0-9]+' },
  types: {
    task: {
      label: 'Task',
      states: { Todo: 'Todo', Done: 'Done' },
      card: { fields: ['id', 'title', 'status'] },
    },
  },
});

function card(id: string, status = 'Todo'): string {
  return `---\nid: ${id}\ntype: task\ntitle: Card ${id}\nstatus: ${status}\n---\nBody.\n`;
}

async function makeVault(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mos-validate-'));
  tmpRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return root;
}

describe('runValidate', () => {
  it('reports a clean vault, surfaces the supported spec, and exits 0', async () => {
    const root = await makeVault({
      '.mos/config.json': CONFIG,
      'board/T-1.md': card('T-1'),
      'board/T-2.md': card('T-2', 'Done'),
    });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(0);
    expect(output).toContain('spec ≤ 0.4');
    expect(output).toContain('OK — valid');
    expect(output).toContain('ALL VAULTS VALID');
  });

  it('exits non-zero when a vault has errors', async () => {
    const root = await makeVault({
      '.mos/config.json': CONFIG,
      'board/a.md': card('T-1'),
      'board/b.md': card('T-1'), // duplicate id — a core validateVault error
    });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(1);
    expect(output).toContain('ERROR(S)');
  });

  it('reports — does not crash — when a status maps to a column outside board.columns', async () => {
    // 'Todoo' is not in board.columns; placeCard returns it, so the report's
    // column layout must route it off-board rather than index a missing bucket.
    const badConfig = CONFIG.replace('"Todo":"Todo"', '"Todo":"Todoo"');
    const root = await makeVault({ '.mos/config.json': badConfig, 'board/T-1.md': card('T-1') });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(1);
    expect(output).toContain("unknown column 'Todoo'");
  });

  it('warns (non-fatally) when a vault targets a newer spec than supported', async () => {
    const root = await makeVault({
      '.mos/config.json': CONFIG.replace('0.4', '0.5'),
      'board/T-1.md': card('T-1'),
    });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(0);
    expect(output).toContain('WARNINGS');
    expect(output).toContain('ALL VAULTS VALID');
  });

  it('discovers a vault nested under the start directory', async () => {
    const root = await makeVault({
      'project/.mos/config.json': CONFIG,
      'project/board/T-1.md': card('T-1'),
    });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(0);
    expect(output).toContain('VAULT: Fixture');
  });

  it('does not follow symlinked directories (no cycle, no duplicate vaults)', async () => {
    const root = await makeVault({ '.mos/config.json': CONFIG, 'board/T-1.md': card('T-1') });
    try {
      await symlink(root, join(root, 'self'), 'dir'); // a link back to the vault root
    } catch (err) {
      // On Windows, creating a directory symlink needs a privilege most setups lack
      // (Developer Mode off ⇒ EPERM). A junction needs none and pins the same
      // guarantee: readdir reports it as a link, not a directory, so the walk must
      // skip it. Anything else is a real failure.
      if ((err as NodeJS.ErrnoException).code !== 'EPERM' || process.platform !== 'win32') {
        throw err;
      }
      await symlink(root, join(root, 'self'), 'junction');
    }
    expect(discoverVaults(root)).toEqual([root]);
    expect(runValidate({ dir: root, cwd: root }).exitCode).toBe(0);
  });

  it('does not discover vaults inside hidden directories (e.g. .claude/worktrees)', async () => {
    const root = await makeVault({
      '.mos/config.json': CONFIG,
      'board/T-1.md': card('T-1'),
      // a git worktree's stale vault copy under .claude must not count as a vault
      '.claude/worktrees/wt/.mos/config.json': CONFIG,
      '.claude/worktrees/wt/board/T-1.md': card('T-1'),
    });
    expect(discoverVaults(root)).toEqual([root]);
  });

  it('exits 2 when no vault is found', async () => {
    const root = await makeVault({ 'readme.md': '# not a vault' });
    const { output, exitCode } = runValidate({ dir: root, cwd: root });
    expect(exitCode).toBe(2);
    expect(output).toContain('Not a mos vault');
  });
});
