import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { createEmptyVaultModel } from '@mos/core';
import { BoardView } from '../views/board/board-view';
import { WikiView } from '../views/wiki/wiki-view';
import { ThemeService } from '../services/theme-service';
import { IconComponent } from '../components/icon/icon';
import { IconMoon, IconSun } from '../icons/tabler-icons.generated';

type View = 'wiki' | 'board';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WikiView, BoardView, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly themeService = inject(ThemeService);

  protected readonly view = signal<View>('wiki');
  protected readonly isDark = this.themeService.isDark;

  protected readonly iconSun = IconSun;
  protected readonly iconMoon = IconMoon;

  /** Placeholder parsed model from the pure core; real parsing fills it in F-003. */
  protected readonly model = signal(createEmptyVaultModel());
  protected readonly cardCount = computed(() => Object.keys(this.model().cards).length);

  protected select(view: View): void {
    this.view.set(view);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
