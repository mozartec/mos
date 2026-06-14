import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isFilterEmpty } from '@mos/core';
import type { Facet, FilterState } from '@mos/core';

/**
 * Config-driven filter bar shared by the board and backlog (and, later, the
 * Cards lens — F-020). Purely presentational: the {@link Facet}s and current
 * {@link FilterState} come in as inputs, every change goes out via
 * `valueChange`. The owner (board/backlog) maps the state to/from the URL, so
 * a filtered view is bookmarkable (ADR-004).
 *
 * Nothing about the fields is hardcoded — facets are built from the vault
 * config and the cards present (`buildFacets`), so a vault's own enum and
 * card-face fields drive the controls (ADR-003).
 */
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2" role="search" aria-label="Filter cards">
      <input
        type="search"
        class="input input-sm w-40 max-w-full"
        [value]="value().q"
        (input)="onText($event)"
        placeholder="Filter…"
        aria-label="Filter cards by text"
      />

      @for (facet of facets(); track facet.field) {
        <select
          class="select w-auto appearance-none select-ghost select-sm"
          (change)="onFacet(facet.field, $event)"
          [attr.aria-label]="'Filter by ' + facet.label"
        >
          <option value="" [selected]="(values()[facet.field] ?? '') === ''">
            {{ facet.label }}: All
          </option>
          @for (opt of facet.options; track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === values()[facet.field]">
              {{ opt.label }}
            </option>
          }
        </select>
      }

      @if (active()) {
        <button type="button" class="btn btn-ghost btn-sm" (click)="clear()">Clear filters</button>
      }
    </div>
  `,
})
export class FilterBar {
  /** The dimensions the bar offers, in display order. */
  readonly facets = input.required<Facet[]>();
  /** The current selection; the bar reflects it and never mutates it. */
  readonly value = input.required<FilterState>();
  /** Emits the next state on every change (text, facet, or clear). */
  readonly valueChange = output<FilterState>();

  /** Selected value per facet field, for binding each `<select>`. */
  protected readonly values = computed(() => this.value().values);

  /** True when any filter is active — gates the Clear button. */
  protected readonly active = computed(() => !isFilterEmpty(this.value()));

  protected onText(event: Event): void {
    this.valueChange.emit({ ...this.value(), q: (event.target as HTMLInputElement).value });
  }

  protected onFacet(field: string, event: Event): void {
    const selected = (event.target as HTMLSelectElement).value;
    const values = { ...this.value().values };
    if (selected === '') delete values[field];
    else values[field] = selected;
    this.valueChange.emit({ ...this.value(), values });
  }

  protected clear(): void {
    this.valueChange.emit({ q: '', values: {} });
  }
}
