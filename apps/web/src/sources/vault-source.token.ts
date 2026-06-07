import { InjectionToken } from '@angular/core';
import type { VaultSource } from '@mos/core';

/**
 * DI token for the active {@link VaultSource} implementation. The UI and views
 * depend on this token, never on a concrete source — so swapping the static
 * stub for the real `HttpVaultSource` (T-002) or `TauriVaultSource` later is a
 * one-line provider change.
 */
export const VAULT_SOURCE = new InjectionToken<VaultSource>('VAULT_SOURCE');
