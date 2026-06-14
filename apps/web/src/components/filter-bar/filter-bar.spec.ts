import { TestBed } from '@angular/core/testing';
import type { Facet, FilterState } from '@mos/core';
import { FilterBar } from './filter-bar';

const FACETS: Facet[] = [
  {
    field: 'type',
    label: 'Type',
    options: [
      { value: 'story', label: 'Story' },
      { value: 'task', label: 'Task' },
    ],
  },
  {
    field: 'priority',
    label: 'Priority',
    options: [
      { value: 'P0', label: 'P0' },
      { value: 'P1', label: 'P1' },
    ],
  },
];

function create(value: FilterState = { q: '', values: {} }) {
  const fixture = TestBed.createComponent(FilterBar);
  fixture.componentRef.setInput('facets', FACETS);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  return fixture;
}

describe('FilterBar', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders a search input and one select per facet', () => {
    const host = create().nativeElement as HTMLElement;
    expect(host.querySelector('input[type="search"]')).not.toBeNull();
    const labels = Array.from(host.querySelectorAll('select')).map((s) =>
      s.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Filter by Type', 'Filter by Priority']);
  });

  it('reflects the current selection in each select', () => {
    const fixture = create({ q: '', values: { priority: 'P1' } });
    const host = fixture.nativeElement as HTMLElement;
    const prioritySelect = host.querySelector(
      '[aria-label="Filter by Priority"]',
    ) as HTMLSelectElement;
    expect(prioritySelect.value).toBe('P1');
  });

  it('emits the new query text on input', () => {
    const fixture = create();
    let emitted: FilterState | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'login';
    input.dispatchEvent(new Event('input'));
    expect(emitted).toEqual({ q: 'login', values: {} });
  });

  it('emits the selected facet value on change', () => {
    const fixture = create();
    let emitted: FilterState | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    const select = fixture.nativeElement.querySelector(
      '[aria-label="Filter by Type"]',
    ) as HTMLSelectElement;
    select.value = 'task';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual({ q: '', values: { type: 'task' } });
  });

  it('drops a facet from the state when cleared back to All', () => {
    const fixture = create({ q: '', values: { type: 'task' } });
    let emitted: FilterState | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    const select = fixture.nativeElement.querySelector(
      '[aria-label="Filter by Type"]',
    ) as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual({ q: '', values: {} });
  });

  it('shows Clear only when a filter is active and resets on click', () => {
    const inactive = create().nativeElement as HTMLElement;
    expect(inactive.querySelector('button')).toBeNull();

    const fixture = create({ q: 'x', values: { type: 'task' } });
    let emitted: FilterState | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (emitted = v));
    const clear = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(clear.textContent).toContain('Clear');
    clear.click();
    expect(emitted).toEqual({ q: '', values: {} });
  });
});
