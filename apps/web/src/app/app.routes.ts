import { Routes } from '@angular/router';

/**
 * Lens routes. Each lens is an independent, bookmarkable view over the vault
 * (ADR-004). The reader takes the file as a `path` query parameter — vault
 * paths contain slashes, which keeps them out of the URL path segments — plus
 * optional `from`/`sprint` parameters so "back" can restore the board's
 * sprint filter (F-004-S-04).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'wiki' },
  {
    path: 'wiki',
    loadComponent: () => import('../views/wiki/wiki-view').then((m) => m.WikiView),
  },
  {
    path: 'board',
    loadComponent: () => import('../views/board/board-view').then((m) => m.BoardView),
  },
  {
    path: 'graph',
    loadComponent: () => import('../views/graph/graph-view').then((m) => m.GraphView),
  },
  {
    path: 'reader',
    loadComponent: () => import('../views/reader/reader-view').then((m) => m.ReaderView),
  },
];
