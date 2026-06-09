import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '../services/theme-service';
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

  protected readonly isDark = this.themeService.isDark;

  protected readonly iconSun = IconSun;
  protected readonly iconMoon = IconMoon;

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
