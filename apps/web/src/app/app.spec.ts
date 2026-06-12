import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { VaultSource } from '@mos/core';
import { App } from './app';
import { routes } from './app.routes';
import { StaticVaultSource } from '../sources/static-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';

/** A source that serves only a vault config with the given name. */
class ConfigOnlySource implements VaultSource {
  constructor(private readonly name: string) {}
  listFiles(): Promise<string[]> {
    return Promise.resolve(['.mos/config.json']);
  }
  readFile(path: string): Promise<string> {
    return path === '.mos/config.json'
      ? Promise.resolve(JSON.stringify({ specVersion: '0.3', vault: { name: this.name } }))
      : Promise.reject(new Error(`No such file: ${path}`));
  }
  watch(): () => void {
    return () => undefined;
  }
}

async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();
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
        { provide: VAULT_SOURCE, useValue: new ConfigOnlySource('Recipe Box') },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const header = (fixture.nativeElement as HTMLElement).querySelector('header');
    expect(header?.textContent).toContain('Recipe Box');
  });

  it('falls back to the product name when the vault has no config', async () => {
    // StaticVaultSource (from beforeEach) serves no .mos/config.json.
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const brand = (fixture.nativeElement as HTMLElement).querySelector('header .navbar-start');
    expect(brand?.textContent?.trim()).toBe('mos');
  });
});
