import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { StaticVaultSource } from '../sources/static-vault-source';
import { VAULT_SOURCE } from '../sources/vault-source.token';

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
});
