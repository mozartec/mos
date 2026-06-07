import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

/** The daisyUI themes registered in `styles.css`. */
export type Theme = 'wireframe' | 'black';

const LIGHT: Theme = 'wireframe';
const DARK: Theme = 'black';
const STORAGE_KEY = 'mos-theme';

/**
 * Tracks the active daisyUI theme and reflects it onto `<html data-theme>`.
 *
 * The initial value is the visitor's saved choice, falling back to their OS
 * `prefers-color-scheme`. The choice is persisted only when toggled, so the OS
 * preference keeps winning until the user explicitly picks a side.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly theme = signal<Theme>(this.initialTheme());
  readonly isDark = computed(() => this.theme() === DARK);

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.theme();
    });
  }

  /** Flip between the light and dark themes and remember the choice. */
  toggle(): void {
    const next: Theme = this.isDark() ? LIGHT : DARK;
    this.theme.set(next);
    this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, next);
  }

  private initialTheme(): Theme {
    // Guard every browser global: the unit-test DOM (and a future SSR pass) may
    // not provide localStorage or matchMedia. Fall back to the light theme.
    const view = this.document.defaultView;
    const stored = view?.localStorage?.getItem(STORAGE_KEY);
    if (stored === LIGHT || stored === DARK) {
      return stored;
    }
    return view?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? DARK : LIGHT;
  }
}
