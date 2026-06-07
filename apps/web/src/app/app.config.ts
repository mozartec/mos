import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StaticVaultSource } from '../sources/static-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Temporary: serve a hardcoded vault until the real source lands (T-002).
    { provide: VAULT_SOURCE, useExisting: StaticVaultSource },
  ],
};
