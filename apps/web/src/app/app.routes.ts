import { Routes } from '@angular/router';

/**
 * Lens routes. Each lens is an independent, bookmarkable view over the vault
 * (ADR-004). The reader takes the file as a `path` query parameter — vault
 * paths contain slashes, which keeps them out of the URL path segments — plus a
 * `from` parameter and the originating board's own state (scope + filters), so
 * "back" restores the exact board view (F-004-S-04, F-023). The card page is
 * id-addressed (`/card/:id`) instead — a card's id is its stable handle — and
 * board-card deep links to the reader redirect onto it (F-021-S-02).
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
    path: 'cards',
    loadComponent: () => import('../views/cards/cards-view').then((m) => m.CardsView),
  },
  {
    path: 'graph',
    loadComponent: () => import('../views/graph/graph-view').then((m) => m.GraphView),
  },
  {
    path: 'card/:id',
    loadComponent: () => import('../views/card/card-view').then((m) => m.CardView),
  },
  {
    path: 'reader',
    loadComponent: () => import('../views/reader/reader-view').then((m) => m.ReaderView),
  },
];
