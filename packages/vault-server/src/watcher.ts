import { readFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import chokidar from 'chokidar';

export type ChangeKind = 'changed' | 'deleted';
const MOS_CONFIG_PATH = '.mos/config.json';
const DEFAULT_RETRY_DELAY_MS = 30;
const WATCHER_STABILITY_THRESHOLD_MS = 50;
const WATCHER_POLL_INTERVAL_MS = 10;
const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.angular',
  '.turbo',
  'dist',
  '.cache',
]);

export interface VaultChangeEvent {
  path: string;
  kind: ChangeKind;
}

type ReadText = (path: string) => Promise<string>;
type Sleep = (ms: number) => Promise<void>;

export function isWatchedRelativePath(path: string): boolean {
  const segments = path.split('/');
  const isMosConfig = path === MOS_CONFIG_PATH;
  if (isMosConfig) return true;
  if (!path.endsWith('.md')) return false;
  return !segments.some((segment) => segment.startsWith('.'));
}

/**
 * Whether the watcher should skip a path entirely. This prunes chokidar's
 * initial scan, which otherwise crawls build outputs and caches — on a
 * monorepo-sized vault that delays the first change event by tens of seconds.
 * Judged on the vault-RELATIVE path: the vault's own absolute location may
 * contain hidden segments (e.g. a git worktree under `.claude/`) that must not
 * match. `.mos` stays watched — the vault config lives there.
 */
export function isIgnoredWatchPath(vaultDir: string, fullPath: string): boolean {
  const rel = relative(vaultDir, resolve(fullPath));
  if (rel === '') return false; // the vault root itself
  if (rel === '..' || rel.startsWith(`..${sep}`)) return true; // outside the vault
  return rel
    .split(sep)
    .some(
      (segment) =>
        IGNORED_DIR_NAMES.has(segment) || (segment.startsWith('.') && segment !== '.mos'),
    );
}

export function toVaultRelativePath(
  filePath: string,
  vaultDir: string,
): string | null {
  const full = resolve(filePath);
  const rel = relative(vaultDir, full);
  if (rel === '..' || rel.startsWith(`..${sep}`)) return null;
  const normalized = rel.replaceAll(sep, '/');
  return isWatchedRelativePath(normalized) ? normalized : null;
}

export async function retryUntilReadable(
  fullPath: string,
  {
    retries = 2,
    delaysMs = [30, 75],
    readText = (path: string) => readFile(path, 'utf-8'),
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  }: {
    retries?: number;
    delaysMs?: number[];
    readText?: ReadText;
    sleep?: Sleep;
  } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await readText(fullPath);
      return true;
    } catch {
      if (attempt >= retries) return false;
      const delayIndex = Math.min(attempt, delaysMs.length - 1);
      const delay = delaysMs[delayIndex] ?? DEFAULT_RETRY_DELAY_MS;
      await sleep(delay);
    }
  }
  return false;
}

export function createDebouncedEmitter(
  onEmit: (event: VaultChangeEvent) => Promise<void> | void,
  debounceMs: number,
): (event: VaultChangeEvent) => void {
  const pending = new Map<
    string,
    { kind: ChangeKind; timer: ReturnType<typeof setTimeout> }
  >();

  return (event: VaultChangeEvent) => {
    const existing = pending.get(event.path);
    if (existing) {
      clearTimeout(existing.timer);
      existing.kind = event.kind;
      existing.timer = setTimeout(() => {
        pending.delete(event.path);
        void onEmit({ path: event.path, kind: existing.kind });
      }, debounceMs);
      return;
    }

    const timer = setTimeout(() => {
      pending.delete(event.path);
      void onEmit(event);
    }, debounceMs);
    pending.set(event.path, { kind: event.kind, timer });
  };
}

export function startVaultWatcher({
  vaultDir,
  onChange,
  debounceMs = 100,
  retries = 2,
  retryDelaysMs = [30, 75],
  readText,
}: {
  vaultDir: string;
  onChange: (event: VaultChangeEvent) => Promise<void> | void;
  debounceMs?: number;
  retries?: number;
  retryDelaysMs?: number[];
  readText?: ReadText;
}): () => Promise<void> {
  const emitDebounced = createDebouncedEmitter(async (event) => {
    if (event.kind === 'changed') {
      const fullPath = resolve(vaultDir, event.path);
      const readable = await retryUntilReadable(fullPath, {
        retries,
        delaysMs: retryDelaysMs,
        readText,
      });
      if (!readable) return;
    }
    await onChange(event);
  }, debounceMs);

  const watcher = chokidar.watch(vaultDir, {
    ignoreInitial: true,
    ignored: (path) => isIgnoredWatchPath(vaultDir, path),
    // Keep values short for responsive updates while still smoothing atomic-save bursts.
    awaitWriteFinish: {
      stabilityThreshold: WATCHER_STABILITY_THRESHOLD_MS,
      pollInterval: WATCHER_POLL_INTERVAL_MS,
    },
  });

  watcher.on('all', (eventName, changedPath) => {
    const rel = toVaultRelativePath(changedPath, vaultDir);
    if (!rel) return;

    const base = basename(rel);
    if (
      base.startsWith('.#') ||
      base.endsWith('~') ||
      base.endsWith('.tmp') ||
      base.endsWith('.swp')
    ) {
      return;
    }

    const kind: ChangeKind = eventName === 'unlink' ? 'deleted' : 'changed';
    emitDebounced({ path: rel, kind });
  });

  return () => watcher.close();
}
