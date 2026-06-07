import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { StaticVaultSource } from '../sources/static-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: VAULT_SOURCE, useClass: StaticVaultSource }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the Wiki | Board toggle', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toContain('Wiki');
    expect(labels).toContain('Board');
  });
});
