import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HttpVaultSource } from '../sources/http-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // HttpVaultSource talks to apps/dev-server via the Angular dev-server proxy
    // at /vault/*. To use the static stub instead (e.g. in tests), change this
    // to: { provide: VAULT_SOURCE, useExisting: StaticVaultSource }  (T-002)
    { provide: VAULT_SOURCE, useExisting: HttpVaultSource },
  ],
};
