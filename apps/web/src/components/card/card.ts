import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AreaCollision, Card, FieldDef, FieldType, TypeDef } from '@mos/core';
import { IconComponent } from '../icon/icon';
import { IconBolt, IconGitMerge, IconLock } from '../../icons/tabler-icons.generated';
import { accentClassFor, badgeClassFor, chipClassFor, iconSvgFor } from './card-style';

interface RenderField {
  key: string;
  label: string;
  value: unknown;
  type: FieldType | 'text';
  formattedValue?: string;
  relativeTime?: string;
  absoluteTime?: string;
  isList?: boolean;
  listValues?: string[];
  /** Per-entry chips for a list `enum` field: each value with its own color. */
  listChips?: { value: string; chipClass: string }[];
  icon?: string;
  chipClass?: string;
}

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

  protected readonly renderedFields = computed<RenderField[]>(() => {
    const card = this.card();
    const typeDef = this.typeDef();
    const registry = this.fieldsRegistry();
    const fieldsToRender = typeDef.card?.fields ?? [];

    const list: RenderField[] = [];
    for (const key of fieldsToRender) {
      if (key === 'id' || key === 'title') continue;

      const rawVal = card.fields[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      if (Array.isArray(rawVal) && rawVal.length === 0) continue;

      const fieldDef = registry[key];
      const label = fieldDef?.label || key;
      const type = fieldDef?.type || 'text';
      const icon = iconSvgFor(fieldDef?.icon);

      if (type === 'datetime' || type === 'date') {
        const timeInfo = this.formatRelativeTime(rawVal);
        if (!timeInfo) continue;
        list.push({
          key,
          label,
          value: rawVal,
          type,
          relativeTime: timeInfo.relative,
          absoluteTime: timeInfo.absolute,
          icon,
        });
      } else if (type === 'enum') {
        if (fieldDef?.list === true || Array.isArray(rawVal)) {
          // Dedup after stringifying: duplicate entries would render twice
          // and collide as @for track keys.
          const entries = [
            ...new Set((Array.isArray(rawVal) ? rawVal : [rawVal]).map((v) => String(v))),
          ];
          list.push({
            key,
            label,
            value: rawVal,
            type,
            isList: true,
            listChips: entries.map((value) => ({
              value,
              chipClass: chipClassFor(fieldDef?.valueColors?.[value]),
            })),
            icon,
          });
        } else {
          list.push({
            key,
            label,
            value: rawVal,
            type,
            formattedValue: String(rawVal),
            chipClass: chipClassFor(fieldDef?.valueColors?.[String(rawVal)]),
            icon,
          });
        }
      } else if (type === 'id') {
        const listValues = Array.isArray(rawVal) ? rawVal.map((v) => String(v)) : [String(rawVal)];
        list.push({
          key,
          label,
          value: rawVal,
          type,
          isList: true,
          listValues,
          icon,
        });
      } else {
        list.push({
          key,
          label,
          value: rawVal,
          type: 'text',
          formattedValue: String(rawVal),
          icon,
        });
      }
    }
    return list;
  });

  protected onSelect(): void {
    this.cardSelect.emit(this.card());
  }

  private formatRelativeTime(value: unknown): { relative: string; absolute: string } | null {
    if (value == null) return null;
    const dateStr = String(value);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 0) {
      return { relative: 'in the future', absolute: date.toISOString() };
    }
    if (diffSecs < 60) {
      return { relative: 'just now', absolute: date.toISOString() };
    }
    if (diffMins < 60) {
      return { relative: `${diffMins}m ago`, absolute: date.toISOString() };
    }
    if (diffHours < 24) {
      return { relative: `${diffHours}h ago`, absolute: date.toISOString() };
    }
    if (diffDays < 30) {
      return { relative: `${diffDays}d ago`, absolute: date.toISOString() };
    }

    return {
      relative: date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      absolute: date.toISOString(),
    };
  }
}
