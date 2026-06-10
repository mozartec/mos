import { readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isWatchedRelativePath } from './watcher';

/** Recursively collect vault-relative paths of .md files and .mos/config.json. */
export async function listVaultFiles(vaultDir: string): Promise<string[]> {
  const files: string[] = [];
  await walk(vaultDir, vaultDir, files);
  return files.sort();
}

async function walk(dir: string, base: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip hidden directories (except .mos) and node_modules
    if (
      entry.isDirectory() &&
      (entry.name === 'node_modules' ||
        (entry.name.startsWith('.') && entry.name !== '.mos'))
    ) {
      continue;
    }

    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(full, base, out);
    } else if (entry.isFile()) {
      const rel = relative(base, full).replaceAll(sep, '/');
      if (entry.name.endsWith('.md') || rel === '.mos/config.json') {
        out.push(rel);
      }
    }
  }
}

/**
 * Resolve a vault-relative request path to an absolute fs path, or return
 * null if the result escapes the vault root (path traversal guard).
 */
export function safeVaultPath(vaultDir: string, reqPath: string): string | null {
  const full = resolve(join(vaultDir, reqPath));
  const rel = relative(vaultDir, full);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return null;
  return full;
}

/** The vault-relative path of an absolute path, with forward slashes. */
export function vaultRelative(vaultDir: string, fullPath: string): string {
  return relative(vaultDir, fullPath).replaceAll(sep, '/');
}

export { isWatchedRelativePath };
