import { TestBed } from '@angular/core/testing';
import type { VaultSource } from '@mos/core';
import { WikiView } from './wiki-view';
import { VAULT_SOURCE } from '../../sources/vault-source.token';

class TestVaultSource implements VaultSource {
  private readonly files: Record<string, string> = {
    'board/T-001-sample.md': [
      '---',
      'id: T-001',
      'type: task',
      'status: Done',
      '---',
      '',
      '# Sample task',
      '',
      'A body line.',
    ].join('\n'),
  };

  listFiles(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.files));
  }

  readFile(path: string): Promise<string> {
    const file = this.files[path];
    return file === undefined ? Promise.reject(new Error(`No such file: ${path}`)) : Promise.resolve(file);
  }

  watch(): () => void {
    return () => undefined;
  }
}

describe('WikiView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WikiView],
      providers: [{ provide: VAULT_SOURCE, useClass: TestVaultSource }],
    }).compileComponents();
  });

  it('renders only markdown body content for files with frontmatter', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sample task');
    expect(text).not.toContain('id: T-001');
    expect(text).not.toContain('type: task');
  });

  it('uses the shared markdown reader component', async () => {
    const fixture = TestBed.createComponent(WikiView);
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('app-markdown-reader').length).toBe(1);
  });
});
