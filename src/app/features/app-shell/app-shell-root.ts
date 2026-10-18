import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../../shared/services/theme';

/**
 * Racine de toute l'application sous `/app` — le point d'entrée des styles
 * d'application que `design-catalog.ts` annonçait devoir déplacer ici une
 * fois la coque existante (Phase 2 → Phase 3). Posée comme `component` de
 * la route wrapper dans `app-shell.routes.ts` : tout écran (splash,
 * onboarding, `MainShell`…) rend à l'intérieur de son `<router-outlet>` et
 * hérite donc de `.nl-app` par ascendance DOM, qu'il porte ou non la classe
 * lui-même — exactement ce que `App` ne pouvait pas garantir à sa propre
 * racine, puisqu'il sert aussi la vitrine (voir `fatal-error.ts`).
 */
@Component({
  selector: 'app-shell-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-app" [attr.data-theme]="theme.attribute()">
      <router-outlet />
    </div>
  `,
  styleUrl: './app-shell-root.scss',
})
export class AppShellRoot {
  protected readonly theme = inject(ThemeService);
}
