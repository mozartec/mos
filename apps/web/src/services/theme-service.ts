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
    try {
      this.document.defaultView?.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort: storage can be full, disabled, or locked
      // down (private mode). A failed write only means the choice won't survive
      // a reload — never a reason to crash the toggle.
    }
  }

  private initialTheme(): Theme {
    const stored = this.readStoredTheme();
    if (stored) {
      return stored;
    }
    // The unit-test DOM (and a future SSR pass) may not provide matchMedia;
    // fall back to the light theme when the OS preference is unknown.
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      ? DARK
      : LIGHT;
  }

  /**
   * Read the persisted theme, or `null` when nothing valid is stored. The read
   * is wrapped because some privacy modes throw on the `localStorage` access
   * itself — which optional chaining can't guard — and that must not break app
   * bootstrap.
   */
  private readStoredTheme(): Theme | null {
    try {
      const stored = this.document.defaultView?.localStorage?.getItem(STORAGE_KEY);
      return stored === LIGHT || stored === DARK ? stored : null;
    } catch {
      return null;
    }
  }
}
