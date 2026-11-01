import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Icon } from '../../shared/ui/icon/icon';
import { ThemeService } from '../../shared/services/theme';

/**
 * Route inconnue.
 *
 * L'application n'en avait aucune : une navigation vers un chemin non déclaré
 * levait `NG04002` dans la console et laissait l'utilisateur sur l'écran
 * précédent, sans rien lui dire. Une erreur muette est pire qu'une erreur
 * visible - celle-ci se remarque, donc elle se corrige.
 *
 * Côté Flutter la question ne se pose pas : on ne tape pas une URL dans une
 * application mobile. Sur le web, si.
 */
@Component({
  selector: 'nl-not-found',
  standalone: true,
  imports: [EmptyState, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-app nl-404" [attr.data-theme]="theme.attribute()">
      <nl-empty-state
        title="Page introuvable"
        subtitle="Ce lien ne mène nulle part. Il a peut-être changé depuis que vous l'avez enregistré."
        ctaLabel="Retour à l'accueil"
        (cta)="accueil()">
        <nl-icon icon name="search" [size]="28" />
      </nl-empty-state>
    </div>
  `,
  styles: [
    `
      .nl-404 {
        min-height: var(--ecran-haut, 100dvh);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-page);
        background: var(--bg-canvas);
      }
    `,
  ],
})
export class NotFound {
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected accueil(): void {
    void this.router.navigate(['/app']);
  }
}
