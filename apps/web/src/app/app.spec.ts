import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { StaticVaultSource } from '../sources/static-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';
import { InMemoryVaultSource, settle } from '../testing/test-helpers';

/** A source serving only a vault config with the given name. */
function configOnlySource(name: string): InMemoryVaultSource {
  return new InMemoryVaultSource({
    '.mos/config.json': JSON.stringify({ specVersion: '0.3', vault: { name } }),
  });
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: VAULT_SOURCE, useClass: StaticVaultSource }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the Wiki | Board navigation links', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(labels).toContain('Wiki');
    expect(labels).toContain('Board');
  });

  it('shows the configured vault name as the navbar brand (ADR-003: not hardcoded)', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: VAULT_SOURCE, useValue: configOnlySource('Recipe Box') },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const header = (fixture.nativeElement as HTMLElement).querySelector('header');
    expect(header?.textContent).toContain('Recipe Box');
    // The configured name carries the brand; the product mark stays alongside.
    expect(header?.textContent).toContain('mos');
  });

  it('falls back to the product name when the vault has no config', async () => {
    // StaticVaultSource (from beforeEach) serves no .mos/config.json.
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const brand = el.querySelector('header .navbar-start');
    expect(brand?.textContent?.trim()).toBe('mos');
    // The brand already says "mos", so the duplicate product mark is hidden.
    const marks = Array.from(el.querySelectorAll('header span')).filter(
      (s) => s.textContent?.trim() === 'mos',
    );
    expect(marks).toHaveLength(1);
  });
});
