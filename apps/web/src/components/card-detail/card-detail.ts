import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  buildEdges,
  childrenOf,
  childrenProgress,
  dependentsOf,
  placeCard,
  type Card,
  type TypeDef,
  type VaultConfig,
  type VaultModel,
} from '@mos/core';
import { MarkdownReader } from '../markdown-reader/markdown-reader';
import { IconComponent } from '../icon/icon';
import { accentClassFor, badgeClassFor } from '../card/card-style';
import { buildRenderFields, type RenderField } from '../card/card-fields';
import { RelationLink, type RelationItem } from './relation-link';

/**
 * Card-detail surface (F-021-S-02): a structured header (mono id, type badge,
 * status, the type's configured field chips — config-driven exactly as on board
 * cards via {@link buildRenderFields}), the card's **relations** (parent
 * breadcrumb, dependencies with status, dependents, and children with a
 * progress summary — all from the pure core lookups of F-021-S-01), then the
 * markdown body through the shared {@link MarkdownReader} (F-017 link behavior).
 *
 * Standalone and host-agnostic: it renders the card it's given and asks the host
 * to navigate, so the card page hosts it now and the side peek (F-021-S-03)
 * reuses it unchanged. Read-only — it surfaces state, never edits (ADR-002).
 */
@Component({
  selector: 'app-card-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownReader, IconComponent, RelationLink],
  templateUrl: './card-detail.html',
})
export class CardDetail {
  readonly card = input.required<Card>();
  readonly model = input.required<VaultModel>();
  readonly config = input.required<VaultConfig>();
  /** Markdown body of the card file ('' while loading or on read failure). */
  readonly body = input.required<string>();
  /** Set when the card's body can't be read, so the miss is visible (T-007). */
  readonly bodyError = input<string>('');

  /** A relation was activated: the referenced card's id, for the host to open. */
  readonly relationNavigate = output<string>();
  /** An in-body link resolved to a vault path, for the host to open (F-017). */
  readonly bodyNavigate = output<string>();

  /** The card's type definition, or undefined for an out-of-vocabulary type. */
  private readonly typeDef = computed<TypeDef | undefined>(
    () => this.config().types[this.card().type],
  );

  /** Display label for the type badge — the configured label, else the raw type. */
  protected readonly typeLabel = computed(() => this.typeDef()?.label ?? this.card().type);

  /** Left accent border tone for the header, by the type's configured color. */
  protected readonly accentClass = computed(() => accentClassFor(this.typeDef()?.color));

  /** Type-badge classes, matching the board card's badge (config color). */
  protected readonly typeBadgeClass = computed(
    () => `border ${badgeClassFor(this.typeDef()?.color)}`,
  );

  /** The card's workflow status, shown as its own chip (no board column here). */
  protected readonly status = computed(() => this.card().status);

  /** Status chip tone: the blocked alert tone, else a quiet soft badge. */
  protected readonly statusBadgeClass = computed(() =>
    placeCard(this.card(), this.config()).blocked ? 'badge-error' : 'badge-soft',
  );

  /**
   * The type's configured fields, rendered exactly as on board cards, minus the
   * relation fields (`parent`/`dependsOn`) which the relations section owns — so
   * nothing is shown twice.
   */
  protected readonly headerFields = computed<RenderField[]>(() => {
    const typeDef = this.typeDef();
    if (typeDef === undefined) return [];
    return buildRenderFields(this.card(), typeDef, this.config().fields).filter(
      (field) => field.key !== 'parent' && field.key !== 'dependsOn',
    );
  });

  /** The parent breadcrumb item, or null when the card has no parent. */
  protected readonly parent = computed<RelationItem | null>(() => {
    const parentId = this.card().fields['parent'];
    if (typeof parentId !== 'string' || parentId === '') return null;
    return this.toItem(parentId);
  });

  /** The card's dependencies (its `dependsOn`), each with its current status. */
  protected readonly dependencies = computed<RelationItem[]>(() => {
    const raw = this.card().fields['dependsOn'];
    const ids = Array.isArray(raw)
      ? raw.map((value) => String(value))
      : raw != null && raw !== ''
        ? [String(raw)]
        : [];
    return ids.map((id) => this.toItem(id));
  });

  /** The cards that depend on this one (reverse edges), from core. */
  protected readonly dependents = computed<RelationItem[]>(() => {
    const { edges } = buildEdges(this.model(), this.config());
    return dependentsOf(this.model(), edges, this.card().id).map((card) => this.cardToItem(card));
  });

  /** This card's direct children, in id order, each with its status. */
  protected readonly children = computed<RelationItem[]>(() =>
    childrenOf(this.model(), this.card().id).map((card) => this.cardToItem(card)),
  );

  /** Children-progress rollup (n done / m total), from core's column mapping. */
  protected readonly progress = computed(() =>
    childrenProgress(this.model(), this.config(), this.card().id),
  );

  /** True when the card has any relation at all — gates the whole section. */
  protected readonly hasRelations = computed(
    () =>
      this.parent() !== null ||
      this.dependencies().length > 0 ||
      this.dependents().length > 0 ||
      this.children().length > 0,
  );

  /** Resolve an id to a relation item, falling back to an inert unresolved one. */
  private toItem(id: string): RelationItem {
    const card = this.model().cards[id];
    return card ? this.cardToItem(card) : { id, title: null, status: null, resolved: false };
  }

  /** A resolved relation item carrying the card's title and status. */
  private cardToItem(card: Card): RelationItem {
    return { id: card.id, title: card.title, status: card.status, resolved: true };
  }
}
