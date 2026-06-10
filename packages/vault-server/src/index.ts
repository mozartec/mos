export { createVaultServer, type VaultServer } from './handler';
export {
  isServedVaultPath,
  isWatchedRelativePath,
  listVaultFiles,
  safeVaultPath,
  vaultRelative,
} from './files';
export {
  createDebouncedEmitter,
  DEFAULT_WATCH_PATHS,
  retryUntilReadable,
  startVaultWatcher,
  toVaultRelativePath,
  watchPathsFromConfig,
  type ChangeKind,
  type VaultChangeEvent,
} from './watcher';
