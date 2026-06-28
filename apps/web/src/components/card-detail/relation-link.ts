import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A card referenced from a relation (parent, dependency, dependent, child),
 * resolved against the vault model. `resolved` is false when the id points at no
 * card — a dangling reference rendered inert rather than as a dead link.
 */
export interface RelationItem {
  id: string;
  title: string | null;
  /** The referenced card's workflow status, shown as a chip. */
  status: string | null;
  resolved: boolean;
}

/**
 * One relation entry in the card-detail surface: a focusable control that asks
 * its host to open the referenced card by id (the host owns where that goes —
 * the page navigates the route, the peek swaps its `?peek=` target — F-021-S-03).
 * An unresolved id renders dimmed and inert, never a broken link, mirroring the
 * markdown reader's treatment of unresolved references (F-017).
 */
@Component({
  selector: 'app-relation-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item().resolved) {
      <button
        type="button"
        class="group inline-flex max-w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors duration-150 ease-out hover:bg-base-200 focus-visible:bg-base-200"
        (click)="navigate.emit(item().id)"
      >
        <span
          class="shrink-0 font-mono text-xs font-semibold tracking-wider text-base-content/60 group-hover:text-base-content"
        >
          {{ item().id }}
        </span>
        @if (item().title) {
          <span class="truncate text-sm text-base-content/85">{{ item().title }}</span>
        }
        @if (item().status) {
          <span class="badge shrink-0 badge-soft py-0.5 badge-xs font-medium">
            {{ item().status }}
          </span>
        }
      </button>
    } @else {
      <span class="inline-flex items-center gap-2 px-1.5 py-1">
        <span class="reference-inert font-mono text-xs font-semibold tracking-wider">
          {{ item().id }}
        </span>
        <span class="text-xs text-base-content/40 italic">unresolved</span>
      </span>
    }
  `,
})
export class RelationLink {
  readonly item = input.required<RelationItem>();

  /** The referenced card's id; the host decides how to open it. */
  readonly navigate = output<string>();
}
