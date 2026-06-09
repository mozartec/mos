import { buildFileTree, flattenTree } from './file-tree';
import type { FileNode, FolderNode } from './file-tree';

// ---------------------------------------------------------------------------
// buildFileTree
// ---------------------------------------------------------------------------

describe('buildFileTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('places root-level files directly in the result', () => {
    const nodes = buildFileTree(['README.md']);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual<FileNode>({
      kind: 'file',
      name: 'README.md',
      path: 'README.md',
    });
  });

  it('groups files in the same folder under one FolderNode', () => {
    const nodes = buildFileTree(['docs/a.md', 'docs/b.md']);
    expect(nodes).toHaveLength(1);
    const folder = nodes[0] as FolderNode;
    expect(folder.kind).toBe('folder');
    expect(folder.name).toBe('docs');
    expect(folder.children).toHaveLength(2);
    expect(folder.children[0]).toEqual<FileNode>({
      kind: 'file',
      name: 'a.md',
      path: 'docs/a.md',
    });
    expect(folder.children[1]).toEqual<FileNode>({
      kind: 'file',
      name: 'b.md',
      path: 'docs/b.md',
    });
  });

  it('handles a mix of root files and nested paths', () => {
    const nodes = buildFileTree(['README.md', 'docs/a.md']);
    // Folders come before files after sorting
    expect(nodes).toHaveLength(2);
    const folder = nodes[0] as FolderNode;
    expect(folder.kind).toBe('folder');
    expect(folder.name).toBe('docs');
    expect(nodes[1]).toEqual<FileNode>({
      kind: 'file',
      name: 'README.md',
      path: 'README.md',
    });
  });

  it('nests folders deeply', () => {
    const nodes = buildFileTree(['a/b/c.md']);
    expect(nodes).toHaveLength(1);
    const a = nodes[0] as FolderNode;
    expect(a.kind).toBe('folder');
    expect(a.name).toBe('a');
    const b = a.children[0] as FolderNode;
    expect(b.kind).toBe('folder');
    expect(b.name).toBe('b');
    expect(b.children[0]).toEqual<FileNode>({
      kind: 'file',
      name: 'c.md',
      path: 'a/b/c.md',
    });
  });

  it('preserves insertion order within a folder', () => {
    const paths = ['board/F-001.md', 'board/F-002.md', 'docs/intro.md'];
    const nodes = buildFileTree(paths);
    const board = nodes[0] as FolderNode;
    expect(board.name).toBe('board');
    expect((board.children[0] as FileNode).path).toBe('board/F-001.md');
    expect((board.children[1] as FileNode).path).toBe('board/F-002.md');
    const docs = nodes[1] as FolderNode;
    expect(docs.name).toBe('docs');
    expect((docs.children[0] as FileNode).path).toBe('docs/intro.md');
  });

  it('puts siblings of the same folder in the same FolderNode across separate paths', () => {
    // docs/ should appear once even though two paths reference it
    const nodes = buildFileTree(['docs/a.md', 'README.md', 'docs/b.md']);
    const folderNodes = nodes.filter((n) => n.kind === 'folder');
    expect(folderNodes).toHaveLength(1);
    const docs = folderNodes[0] as FolderNode;
    expect(docs.children).toHaveLength(2);
  });

  it('sorts children: folders first then files, alphabetically', () => {
    const nodes = buildFileTree(['docs/b.md', 'docs/a.md', 'README.md', 'src/util.md']);
    // Root: folders ('docs', 'src') before files ('README.md'), alphabetical within each kind
    expect(nodes[0]).toMatchObject({ kind: 'folder', name: 'docs' });
    expect(nodes[1]).toMatchObject({ kind: 'folder', name: 'src' });
    expect(nodes[2]).toMatchObject({ kind: 'file', name: 'README.md' });
    // Within docs: files sorted alphabetically despite insertion order (b before a)
    const docs = nodes[0] as FolderNode;
    expect((docs.children[0] as FileNode).name).toBe('a.md');
    expect((docs.children[1] as FileNode).name).toBe('b.md');
  });
});

// ---------------------------------------------------------------------------
// flattenTree
// ---------------------------------------------------------------------------

describe('flattenTree', () => {
  it('returns empty array for empty tree', () => {
    expect(flattenTree([], new Set())).toEqual([]);
  });

  it('includes root-level files regardless of expanded set', () => {
    const tree = buildFileTree(['README.md']);
    const entries = flattenTree(tree, new Set());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'file', path: 'README.md', depth: 0 });
  });

  it('includes folders at depth 0', () => {
    const tree = buildFileTree(['docs/a.md']);
    const entries = flattenTree(tree, new Set());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'folder', name: 'docs', depth: 0 });
  });

  it('suppresses folder children when the folder is not expanded', () => {
    const tree = buildFileTree(['docs/a.md', 'docs/b.md']);
    const entries = flattenTree(tree, new Set());
    // Only the folder row; children hidden
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'folder', name: 'docs' });
  });

  it('reveals folder children when the folder key is in expanded', () => {
    const tree = buildFileTree(['docs/a.md', 'docs/b.md']);
    const entries = flattenTree(tree, new Set(['docs']));
    expect(entries).toHaveLength(3); // folder + 2 files
    expect(entries[0]).toMatchObject({ kind: 'folder', name: 'docs', depth: 0 });
    expect(entries[1]).toMatchObject({ kind: 'file', path: 'docs/a.md', depth: 1 });
    expect(entries[2]).toMatchObject({ kind: 'file', path: 'docs/b.md', depth: 1 });
  });

  it('uses the full ancestry path as the folder key', () => {
    const tree = buildFileTree(['a/b/c.md']);
    // Expand the outer folder 'a' to reveal folder 'b'
    const outer = flattenTree(tree, new Set(['a']));
    expect(outer[0]).toMatchObject({ kind: 'folder', key: 'a' });
    expect(outer[1]).toMatchObject({ kind: 'folder', key: 'a/b' });

    // Now also expand 'a/b' to reveal the file
    const both = flattenTree(tree, new Set(['a', 'a/b']));
    expect(both).toHaveLength(3);
    expect(both[2]).toMatchObject({ kind: 'file', key: 'a/b/c.md', depth: 2 });
  });

  it('assigns file key equal to its vault-relative path', () => {
    const tree = buildFileTree(['docs/guide.md']);
    const entries = flattenTree(tree, new Set(['docs']));
    const file = entries.find((e) => e.kind === 'file');
    expect(file?.key).toBe('docs/guide.md');
  });
});
