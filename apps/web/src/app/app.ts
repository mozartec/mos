import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { loadConfig } from '@mos/core';
import { ThemeService } from '../services/theme-service';
import { VAULT_SOURCE } from '../sources/vault-source.token';
import { IconComponent } from '../components/icon/icon';
import { IconMoon, IconSun } from '../icons/tabler-icons.generated';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly themeService = inject(ThemeService);
  private readonly title = inject(Title);
  private readonly source = inject(VAULT_SOURCE);

  protected readonly isDark = this.themeService.isDark;

  protected readonly iconSun = IconSun;
  protected readonly iconMoon = IconMoon;

  constructor() {
    // The static <title> is "mos"; upgrade it to the vault's own name once the
    // config is readable (T-008). A missing/invalid config keeps the fallback.
    void this.source
      .readFile('.mos/config.json')
      .then((text) => {
        const name = loadConfig(text).config.vault.name;
        if (name) this.title.setTitle(name);
      })
      .catch(() => undefined);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
