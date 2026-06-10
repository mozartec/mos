import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Nearest directory at or above `start` containing .mos/config.json, or null. */
export function findVault(start: string): string | null {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.mos', 'config.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
