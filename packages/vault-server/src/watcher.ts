import { readFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import chokidar from 'chokidar';

export type ChangeKind = 'changed' | 'deleted';
const MOS_CONFIG_PATH = '.mos/config.json';
const DEFAULT_RETRY_DELAY_MS = 30;
const WATCHER_STABILITY_THRESHOLD_MS = 50;
const WATCHER_POLL_INTERVAL_MS = 10;
/** Watched when the vault config has no `watch` key (plus the config itself). */
export const DEFAULT_WATCH_PATHS = ['board', 'docs'];

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
 * The vault-relative paths (folders or files) the watcher should cover, from
 * the parsed vault config's optional top-level `watch` key. Watching is an
 * allowlist — the configured folders plus the config file itself — never a
 * crawl-everything-and-ignore-some heuristic: on a monorepo-sized vault that
 * crawl delays the first change event by tens of seconds.
 */
export function watchPathsFromConfig(config: unknown): string[] {
  const watch = (config as { watch?: unknown } | null)?.watch;
  const paths =
    Array.isArray(watch) && watch.every((p) => typeof p === 'string' && p.length > 0)
      ? (watch as string[])
      : DEFAULT_WATCH_PATHS;
  return [...new Set([...paths, MOS_CONFIG_PATH])];
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
  watchPaths = [...DEFAULT_WATCH_PATHS, MOS_CONFIG_PATH],
  onChange,
  debounceMs = 100,
  retries = 2,
  retryDelaysMs = [30, 75],
  readText,
}: {
  vaultDir: string;
  /** Vault-relative folders/files to watch (see {@link watchPathsFromConfig}). */
  watchPaths?: string[];
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

  // Watch only the configured subtrees — chokidar tolerates paths that don't
  // exist yet (e.g. a docs/ created later) and picks them up on creation.
  const watcher = chokidar.watch(
    watchPaths.map((p) => resolve(vaultDir, p)),
    {
      ignoreInitial: true,
      // Keep values short for responsive updates while still smoothing atomic-save bursts.
      awaitWriteFinish: {
        stabilityThreshold: WATCHER_STABILITY_THRESHOLD_MS,
        pollInterval: WATCHER_POLL_INTERVAL_MS,
      },
    },
  );

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
