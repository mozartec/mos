import { TestBed } from '@angular/core/testing';
import { CardComponent } from './card';
import type { AreaCollision, Card, FieldDef, TypeDef } from '@mos/core';

describe('CardComponent', () => {
  const testFieldsRegistry: Record<string, FieldDef> = {
    id: { type: 'id', label: 'ID' },
    priority: {
      type: 'enum',
      values: ['P0', 'P1', 'P2', 'P3'],
      label: 'Priority',
      icon: 'flag',
      valueColors: { P0: 'red', P1: 'amber', P2: 'blue', P3: 'slate' },
    },
    owner: { type: 'string', label: 'Owner', icon: 'user' },
    sprint: { type: 'enum', values: ['S1', 'S2', 'S3'], label: 'Sprint', icon: 'calendar' },
    created: { type: 'datetime', label: 'Created', icon: 'clock' },
    updated: { type: 'datetime', label: 'Updated', icon: 'clock' },
    dependsOn: { type: 'id', label: 'Depends on', icon: 'git-commit' },
  };

  const testTypeDef: TypeDef = {
    label: 'Story',
    parent: 'feature',
    color: 'green',
    states: { Todo: 'Backlog', Done: 'Done' },
    card: { fields: ['id', 'priority', 'owner', 'sprint', 'created', 'updated', 'dependsOn'] },
  };

  const testCard: Card = {
    id: 'F-004-S-02',
    type: 'story',
    title: 'Implement Card Component',
    status: 'Todo',
    path: 'board/F-004-S-02.md',
    priority: 'P0',
    fields: {
      id: 'F-004-S-02',
      type: 'story',
      title: 'Implement Card Component',
      status: 'Todo',
      priority: 'P0',
      owner: 'mozart',
      sprint: 'S2',
      created: '2026-06-07T12:00:00Z',
      // updated is missing/omitted
    },
  };

  async function createComponent(inputs: {
    card: Card;
    typeDef: TypeDef;
    fieldsRegistry: Record<string, FieldDef>;
    blocked?: boolean;
    collisions?: AreaCollision[];
    safeToStart?: boolean;
  }) {
    await TestBed.configureTestingModule({
      imports: [CardComponent],
    }).compileComponents();

    // Set inputs
    const fixture = TestBed.createComponent(CardComponent);
    fixture.componentRef.setInput('card', inputs.card);
    fixture.componentRef.setInput('typeDef', inputs.typeDef);
    fixture.componentRef.setInput('fieldsRegistry', inputs.fieldsRegistry);
    if (inputs.blocked !== undefined) {
      fixture.componentRef.setInput('blocked', inputs.blocked);
    }
    if (inputs.collisions !== undefined) {
      fixture.componentRef.setInput('collisions', inputs.collisions);
    }
    if (inputs.safeToStart !== undefined) {
      fixture.componentRef.setInput('safeToStart', inputs.safeToStart);
    }

    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders the card ID and title', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('F-004-S-02');
    expect(host.textContent).toContain('Implement Card Component');
  });

  it('renders exactly the declared fields in order, omitting missing ones', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;

    // Check that present fields are rendered
    expect(host.textContent).toContain('Priority');
    expect(host.textContent).toContain('Owner');
    expect(host.textContent).toContain('Sprint');
    expect(host.textContent).toContain('Created');

    // Values
    expect(host.textContent).toContain('P0');
    expect(host.textContent).toContain('mozart');
    expect(host.textContent).toContain('S2');

    // Missing 'updated' should not be rendered
    expect(host.textContent).not.toContain('Updated');
  });

  it('renders datetime relative time with absolute time in title attribute', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;

    // Find the datetime element
    const timeEl = host.querySelector('[title="2026-06-07T12:00:00.000Z"]');
    expect(timeEl).not.toBeNull();
    expect(timeEl?.textContent?.trim()).not.toBe('');
  });

  it('shows no Blocked badge when blocked is false', async () => {
    const fixtureNotBlocked = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
      blocked: false,
    });
    expect(fixtureNotBlocked.nativeElement.textContent).not.toContain('Blocked');
  });

  it('shows Blocked badge when blocked is true', async () => {
    const fixtureBlocked = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
      blocked: true,
    });
    expect(fixtureBlocked.nativeElement.textContent).toContain('Blocked');
  });

  it('emits select event on click/Enter/Space', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const component = fixture.componentInstance;

    let emittedCard: Card | undefined;
    component.cardSelect.subscribe((c) => {
      emittedCard = c;
    });

    const host = fixture.nativeElement as HTMLElement;
    host.click();
    expect(emittedCard).toEqual(testCard);

    emittedCard = undefined;
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emittedCard).toEqual(testCard);

    emittedCard = undefined;
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(emittedCard).toEqual(testCard);
  });

  it('applies the type color to the accent and the type badge', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;

    // Accent comes from the type's color ('green'), not the type name.
    expect(host.className).toContain('border-l-green-500');
    // Type badge is colored from the same token.
    expect(host.innerHTML).toContain('bg-green-100');
  });

  it('falls back to a neutral accent when the type declares no color', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: { ...testTypeDef, color: undefined },
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toContain('border-l-base-content/25');
    expect(host.className).not.toContain('border-l-green-500');
  });

  it('colors an enum value chip from the field valueColors map', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    // priority P0 → 'red' per valueColors.
    expect(fixture.nativeElement.innerHTML).toContain('bg-red-100');
  });

  it('renders a list enum as one chip per entry, each colored by its own value', async () => {
    const fixture = await createComponent({
      card: {
        ...testCard,
        fields: { ...testCard.fields, touches: ['core', 'web'] },
      },
      typeDef: {
        ...testTypeDef,
        card: { fields: ['touches'] },
      },
      fieldsRegistry: {
        ...testFieldsRegistry,
        touches: {
          type: 'enum',
          source: 'areas',
          list: true,
          label: 'Touches',
          valueColors: { core: 'red' },
        },
      },
    });
    const host = fixture.nativeElement as HTMLElement;
    const chips = [...host.querySelectorAll('.badge')].filter(
      (el) => el.textContent?.trim() === 'core' || el.textContent?.trim() === 'web',
    );
    expect(chips.length).toBe(2); // separate chips, never one "core,web" chip
    expect(host.textContent).not.toContain('core,web');
    expect(chips[0].className).toContain('bg-red-100'); // per-value color, not whole-list lookup
  });

  it('omits a list field whose value is an empty list', async () => {
    const fixture = await createComponent({
      card: {
        ...testCard,
        fields: { ...testCard.fields, touches: [], dependsOn: [] },
      },
      typeDef: { ...testTypeDef, card: { fields: ['touches', 'dependsOn'] } },
      fieldsRegistry: {
        ...testFieldsRegistry,
        touches: { type: 'enum', source: 'areas', list: true, label: 'Touches' },
      },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('Touches');
    expect(host.textContent).not.toContain('Depends on');
  });

  it('renders an icon for a field that declares one', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    // Not blocked, so any <svg> present comes from a field icon (owner/priority/...).
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  // ── F-026: collision badge + safe-to-start highlight ──────────────────────

  it('shows no collision badge or safe ring by default', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('Safe to start');
    expect(host.className).not.toContain('ring-accent');
  });

  it('renders a collision badge naming the shared area(s), card(s) in the title', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
      collisions: [
        { with: 'F-027', areas: ['core'] },
        { with: 'F-028', areas: ['core', 'web'] },
      ],
    });
    const host = fixture.nativeElement as HTMLElement;
    const badge = [...host.querySelectorAll('.badge-warning')].at(0);
    expect(badge).toBeDefined();
    // Distinct area names, deduped across overlaps.
    expect(badge?.textContent).toContain('core');
    expect(badge?.textContent).toContain('web');
    // Tooltip names the colliding cards and their shared areas.
    expect(badge?.getAttribute('title')).toContain('F-027 (core)');
    expect(badge?.getAttribute('title')).toContain('F-028 (core, web)');
  });

  it('renders the safe-to-start badge and accent ring when safe', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: testFieldsRegistry,
      safeToStart: true,
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Safe to start');
    expect(host.className).toContain('ring-accent/50');
  });

  it('renders no field icons when no field declares one', async () => {
    const fixture = await createComponent({
      card: testCard,
      typeDef: testTypeDef,
      fieldsRegistry: {
        priority: { type: 'enum', values: ['P0', 'P1', 'P2', 'P3'], label: 'Priority' },
        owner: { type: 'string', label: 'Owner' },
        sprint: { type: 'enum', values: ['S1', 'S2', 'S3'], label: 'Sprint' },
        created: { type: 'datetime', label: 'Created' },
      },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('svg').length).toBe(0);
  });
});
