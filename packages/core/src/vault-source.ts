/**
 * The single interface through which the app reads a vault.
 *
 * All filesystem, HTTP, or Tauri access lives behind an implementation of this
 * type — never in the UI or in core logic (ADR-001, ADR-002). The core defines
 * only the type; concrete sources live in the app that uses them (for example
 * `StaticVaultSource` and the future `HttpVaultSource` in `apps/web/src/sources`,
 * or `TauriVaultSource` in `apps/desktop`). Swapping one for another changes
 * nothing in the UI or the core.
 */
export interface VaultSource {
  /** List every vault-relative file path the source can read. */
  listFiles(): Promise<string[]>;

  /** Read one file's raw text contents by its vault-relative path. */
  readFile(path: string): Promise<string>;

  /**
   * Subscribe to change notifications. `onChange` is called with the path of
   * any file that changes. Returns an unsubscribe function.
   */
  watch(onChange: (path: string) => void): () => void;
}
