/**
 * Pure tree-building utilities for the wiki file browser.
 *
 * No Angular dependency — fully unit-testable. Consumes the filtered list of
 * wiki-scope file paths (already filtered by the vault config's
 * `wiki.include`/`exclude` globs) and produces either a nested tree or a flat
 * visible-entries list for the view to render.
 */

/** A leaf node: one markdown file. */
export interface FileNode {
  readonly kind: 'file';
  /** Last path segment, e.g. `01-VISION.md`. */
  readonly name: string;
  /** Full vault-relative path, e.g. `docs/01-VISION.md`. */
  readonly path: string;
}

/** An interior node: a folder grouping files and sub-folders. */
export interface FolderNode {
  readonly kind: 'folder';
  /** Folder's single path segment, e.g. `docs`. */
  readonly name: string;
  /** Direct children in insertion order. */
  readonly children: readonly TreeNode[];
}

/** A tree node is either a file leaf or a folder interior node. */
export type TreeNode = FileNode | FolderNode;

/**
 * A flattened tree entry ready for linear rendering.
 *
 * Folders and files both carry a `key` (unique within the tree) and a `depth`
 * (zero-based nesting level) so the template can indent without recursion.
 * Only the nodes that are currently visible (i.e. all their ancestor folders
 * are in the `expanded` set passed to {@link flattenTree}) are included.
 */
export type FlatEntry =
  | {
      readonly kind: 'folder';
      /** Ancestry-relative key: slash-joined path from tree root, e.g. `docs`. */
      readonly key: string;
      readonly name: string;
      readonly depth: number;
    }
  | {
      readonly kind: 'file';
      /** Same as `path` — unique per file. */
      readonly key: string;
      /** Full vault-relative path, e.g. `docs/01-VISION.md`. */
      readonly path: string;
      readonly name: string;
      readonly depth: number;
    };

// ---------------------------------------------------------------------------
// buildFileTree
// ---------------------------------------------------------------------------

/**
 * Build a nested tree from a flat list of vault-relative paths.
 *
 * Each intermediate path segment becomes a {@link FolderNode} and each final
 * segment a {@link FileNode}. Insertion order of `paths` is preserved within
 * each folder. Excluded paths must not arrive here — filtering is the caller's
 * responsibility.
 *
 * @example
 * buildFileTree(['README.md', 'docs/a.md', 'docs/b.md'])
 * // → [
 * //   { kind: 'file',   name: 'README.md', path: 'README.md' },
 * //   { kind: 'folder', name: 'docs', children: [
 * //     { kind: 'file', name: 'a.md', path: 'docs/a.md' },
 * //     { kind: 'file', name: 'b.md', path: 'docs/b.md' },
 * //   ]},
 * // ]
 */
export function buildFileTree(paths: readonly string[]): readonly TreeNode[] {
  const root: MutableFolder = { kind: 'folder', name: '', children: [] };
  for (const path of paths) {
    insertPath(root, path.split('/'), 0, path);
  }
  return root.children;
}

// Mutable intermediate type used only during tree construction.
interface MutableFolder {
  kind: 'folder';
  name: string;
  children: TreeNode[];
}

function insertPath(
  node: MutableFolder,
  parts: readonly string[],
  depth: number,
  fullPath: string,
): void {
  if (parts.length === 0) return;

  if (depth === parts.length - 1) {
    // Leaf — add a file node.
    node.children.push({ kind: 'file', name: parts[depth]!, path: fullPath });
    return;
  }

  // Interior — find or create the folder for this path segment.
  const folderName = parts[depth]!;
  let folder = node.children.find(
    (c): c is MutableFolder => c.kind === 'folder' && c.name === folderName,
  ) as MutableFolder | undefined;
  if (!folder) {
    folder = { kind: 'folder', name: folderName, children: [] };
    node.children.push(folder);
  }
  insertPath(folder, parts, depth + 1, fullPath);
}

// ---------------------------------------------------------------------------
// flattenTree
// ---------------------------------------------------------------------------

/**
 * Convert a nested tree into a flat list of visible {@link FlatEntry} nodes.
 *
 * Only nodes whose entire ancestor chain is in `expanded` are included, so the
 * result is exactly what the template should render. Folders not in `expanded`
 * suppress their children.
 *
 * @param nodes    Top-level nodes from {@link buildFileTree}.
 * @param expanded Set of folder keys (as produced by `FlatEntry.key`) that are
 *                 currently open.
 * @param depth    Starting depth (defaults to 0; callers need not pass this).
 * @param parentKey Slash-joined ancestry path (defaults to ''; callers need not pass this).
 */
export function flattenTree(
  nodes: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  depth = 0,
  parentKey = '',
): FlatEntry[] {
  const result: FlatEntry[] = [];
  for (const node of nodes) {
    const key = parentKey ? `${parentKey}/${node.name}` : node.name;
    if (node.kind === 'folder') {
      result.push({ kind: 'folder', key, name: node.name, depth });
      if (expanded.has(key)) {
        result.push(...flattenTree(node.children, expanded, depth + 1, key));
      }
    } else {
      result.push({ kind: 'file', key: node.path, path: node.path, name: node.name, depth });
    }
  }
  return result;
}
