import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

/**
 * Renders a Tabler icon (from src/icons/tabler-icons.generated.ts) inline.
 *
 * Usage:
 *   import { IconSun } from '../../icons/tabler-icons.generated';
 *   <app-icon [icon]="IconSun" />
 *   <app-icon [icon]="IconSun" [size]="20" label="Switch to light theme" />
 *
 * - `icon` is the generated SVG string — only imported icons reach the bundle.
 * - The host controls size; the injected SVG fills it and inherits `currentColor`.
 * - Pass `label` for a meaningful icon (sets role="img"); omit it when the icon
 *   is decorative and its meaning is already conveyed by adjacent text.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    :host ::ng-deep svg {
      width: 100%;
      height: 100%;
    }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[innerHTML]': 'safeIcon()',
  },
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly icon = input.required<string>();
  readonly size = input<number>(24);
  readonly label = input<string>('');

  protected readonly safeIcon = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.icon()),
  );
}
