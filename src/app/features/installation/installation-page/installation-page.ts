import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TraductionPipe } from '../../../core/i18n';
import { AppRoutes } from '../../../core/router/app-routes';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { GuideInstallation } from '../../../shared/ui/guide-installation/guide-installation';

/** Le guide d'installation en pleine page, ouvert depuis les Réglages. */
@Component({
  selector: 'nl-installation-page',
  standalone: true,
  imports: [TraductionPipe, PageBar, GuideInstallation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nl-page-bar [titre]="'installReglageTitre' | t" (retour)="retour()" />
    <div class="page"><nl-guide-installation /></div>
  `,
  styles: `
    :host { display: block; min-height: var(--ecran-haut, 100dvh); background: var(--bg-canvas); }
    .page { padding: var(--space-lg) var(--space-page) var(--space-xxxl); }
  `,
})
export class InstallationPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected retour(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/app', AppRoutes.profil]);
  }
}
