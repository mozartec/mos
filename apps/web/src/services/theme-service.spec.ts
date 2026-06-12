import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme-service';

/**
 * A minimal DOCUMENT stand-in: just the parts the service touches, with
 * controllable storage and OS color-scheme preference.
 */
function fakeDocument(opts: { stored?: string; osPrefersDark?: boolean } = {}) {
  const storage = new Map<string, string>();
  if (opts.stored !== undefined) {
    storage.set('mos-theme', opts.stored);
  }
  return {
    documentElement: { dataset: {} as Record<string, string> },
    defaultView: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
      matchMedia: (query: string) => ({
        matches: query.includes('dark') && (opts.osPrefersDark ?? false),
      }),
    },
    storage,
  };
}

function serviceWith(doc: ReturnType<typeof fakeDocument>): ThemeService {
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: doc }] });
  return TestBed.inject(ThemeService);
}

describe('ThemeService', () => {
  it('defaults to mos-paper when nothing is stored and the OS is light', () => {
    const service = serviceWith(fakeDocument({ osPrefersDark: false }));
    expect(service.theme()).toBe('mos-paper');
    expect(service.isDark()).toBe(false);
  });

  it('follows the OS preference to mos-carbon when nothing is stored', () => {
    const service = serviceWith(fakeDocument({ osPrefersDark: true }));
    expect(service.theme()).toBe('mos-carbon');
    expect(service.isDark()).toBe(true);
  });

  it('restores a stored theme over the OS preference', () => {
    const service = serviceWith(fakeDocument({ stored: 'mos-paper', osPrefersDark: true }));
    expect(service.theme()).toBe('mos-paper');
  });

  it('migrates a stored legacy "wireframe" to mos-paper and rewrites the stored value', () => {
    const doc = fakeDocument({ stored: 'wireframe', osPrefersDark: true });
    const service = serviceWith(doc);
    expect(service.theme()).toBe('mos-paper');
    expect(doc.storage.get('mos-theme')).toBe('mos-paper');
  });

  it('migrates a stored legacy "black" to mos-carbon and rewrites the stored value', () => {
    const doc = fakeDocument({ stored: 'black', osPrefersDark: false });
    const service = serviceWith(doc);
    expect(service.theme()).toBe('mos-carbon');
    expect(doc.storage.get('mos-theme')).toBe('mos-carbon');
  });

  it('ignores an unknown stored value and falls back to the OS preference', () => {
    const service = serviceWith(fakeDocument({ stored: 'solarized', osPrefersDark: false }));
    expect(service.theme()).toBe('mos-paper');
  });

  it('toggles between the themes and persists the choice', () => {
    const doc = fakeDocument({ osPrefersDark: false });
    const service = serviceWith(doc);
    service.toggle();
    expect(service.theme()).toBe('mos-carbon');
    expect(doc.storage.get('mos-theme')).toBe('mos-carbon');
    service.toggle();
    expect(service.theme()).toBe('mos-paper');
    expect(doc.storage.get('mos-theme')).toBe('mos-paper');
  });

  it('reflects the active theme onto <html data-theme>', () => {
    const doc = fakeDocument({ osPrefersDark: false });
    const service = serviceWith(doc);
    TestBed.tick();
    expect(doc.documentElement.dataset['theme']).toBe('mos-paper');
    service.toggle();
    TestBed.tick();
    expect(doc.documentElement.dataset['theme']).toBe('mos-carbon');
  });
});
