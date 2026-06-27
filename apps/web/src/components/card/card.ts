import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AreaCollision, Card, FieldDef, TypeDef } from '@mos/core';
import { IconComponent } from '../icon/icon';
import { IconBolt, IconGitMerge, IconLock } from '../../icons/tabler-icons.generated';
import { accentClassFor, badgeClassFor } from './card-style';
import { buildRenderFields, type RenderField } from './card-fields';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './card.html',
  host: {
    '[class]': 'hostClass()',
    tabindex: '0',
    role: 'button',
    '(click)': 'onSelect()',
    '(keydown.enter)': 'onSelect()',
    '(keydown.space)': 'onSelect(); $event.preventDefault()',
  },
})
export class CardComponent {
  readonly card = input.required<Card>();
  readonly typeDef = input.required<TypeDef>();
  readonly fieldsRegistry = input.required<Record<string, FieldDef>>();
  readonly blocked = input<boolean>(false);
  /**
   * In-flight area overlaps with other in-progress cards (F-026, core
   * `inFlightCollisions`). Non-empty only for a card in the in-flight column;
   * drives the collision badge.
   */
  readonly collisions = input<AreaCollision[]>([]);
  /**
   * True when this card is ready and its surface is disjoint from all in-flight
   * work (F-026, core `safeToStart`) — gets the safe-to-start highlight.
   */
  readonly safeToStart = input<boolean>(false);

  readonly cardSelect = output<Card>();

  protected readonly iconLock = IconLock;
  protected readonly iconGitMerge = IconGitMerge;
  protected readonly iconBolt = IconBolt;

  /** True when this in-flight card shares an area with another in-flight card. */
  protected readonly hasCollision = computed(() => this.collisions().length > 0);

  /** The distinct shared area names, for the collision badge label. */
  protected readonly collisionAreas = computed<string[]>(() => [
    ...new Set(this.collisions().flatMap((c) => c.areas)),
  ]);

  /** Tooltip naming each colliding card and the area(s) shared with it. */
  protected readonly collisionTitle = computed<string>(() =>
    this.collisions()
      .map((c) => `${c.with} (${c.areas.join(', ')})`)
      .join('; '),
  );

  protected readonly hostClass = computed(() => {
    // Hairlines separate, shadows mean elevation: the card earns its shadow
    // only while raised on hover (design system §Shape, §Motion). Focus comes
    // from the global focus-visible ring in styles.css.
    const base =
      'card bg-base-100 border-y border-r border-base-content/10 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ease-out cursor-pointer block rounded-box p-3';
    const accent = this.accentClass();
    const blockedClass = this.blocked() ? 'border border-error/40 border-l-error bg-error/5' : '';
    // Safe-to-start: a subtle accent ring — the board echo of the graph's
    // accent-toned ready set (design system §Color: accent = ready set).
    const safeClass = this.safeToStart() ? 'ring-1 ring-accent/50' : '';
    return `${base} ${accent} ${blockedClass} ${safeClass}`.trim();
  });

  protected readonly accentClass = computed(
    () => `border-l-4 ${accentClassFor(this.typeDef().color)}`,
  );

  protected readonly typeBadgeClass = computed(
    () => `border ${badgeClassFor(this.typeDef().color)}`,
  );

  protected readonly renderedFields = computed<RenderField[]>(() =>
    buildRenderFields(this.card(), this.typeDef(), this.fieldsRegistry()),
  );

  protected onSelect(): void {
    this.cardSelect.emit(this.card());
  }
}
