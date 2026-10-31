import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../../shared/services/theme';
import { OfflineBanner } from '../../shared/ui/offline-banner/offline-banner';
import { Icon } from '../../shared/ui/icon/icon';
import { ReseauService } from '../../core/network/reseau.service';
import { MiseAJourService } from '../../core/pwa/mise-a-jour.service';
import { InstallationService } from '../../core/pwa/installation.service';
import { AuthService } from '../../core/auth/auth.service';
import { PreferenceNotifications } from '../../core/notifications/preference-notifications';
import { estAuthentifie } from '../../core/auth/auth.model';

/**
 * Racine de toute l'application sous `/app` — le point d'entrée des styles
 * d'application que `design-catalog.ts` annonçait devoir déplacer ici une
 * fois la coque existante (Phase 2 → Phase 3). Posée comme `component` de
 * la route wrapper dans `app-shell.routes.ts` : tout écran (splash,
 * onboarding, `MainShell`…) rend à l'intérieur de son `<router-outlet>` et
 * hérite donc de `.nl-app` par ascendance DOM, qu'il porte ou non la classe
 * lui-même — exactement ce que `App` ne pouvait pas garantir à sa propre
 * racine, puisqu'il sert aussi la vitrine (voir `fatal-error.ts`).
 *
 * C'est aussi le seul endroit qui voit tous les écrans à la fois : les trois
 * bandeaux d'état de l'application (réseau coupé, nouvelle version, invitation
 * à installer) vivent ici plutôt que recopiés dans chacun.
 */
@Component({
  selector: 'app-shell-root',
  standalone: true,
  imports: [RouterOutlet, OfflineBanner, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-app" [attr.data-theme]="theme.attribute()">
      @if (!reseau.enLigne()) {
        <nl-offline-banner />
      }

      @if (majDisponible()) {
        <div class="nl-bandeau nl-bandeau--maj" role="status">
          <nl-icon name="refresh" [size]="18" />
          <span class="nl-bandeau__texte">Une nouvelle version est disponible.</span>
          <button type="button" class="nl-bandeau__action" (click)="appliquerMaj()">
            Mettre à jour
          </button>
        </div>
      }

      @if (installation.peutProposer()) {
        <div class="nl-bandeau" role="status">
          <nl-icon name="download" [size]="18" />
          <span class="nl-bandeau__texte">Installer NextLearn sur ton téléphone ?</span>
          <button type="button" class="nl-bandeau__action" (click)="installer()">Installer</button>
          <button
            type="button"
            class="nl-bandeau__fermer"
            aria-label="Ne plus proposer"
            (click)="installation.memoriserRefus()">
            <nl-icon name="close" [size]="18" />
          </button>
        </div>
      } @else if (installation.besoinGuideIos()) {
        <div class="nl-bandeau" role="status">
          <nl-icon name="download" [size]="18" />
          <span class="nl-bandeau__texte">
            Pour installer : Partager, puis « Sur l'écran d'accueil ».
          </span>
          <button
            type="button"
            class="nl-bandeau__fermer"
            aria-label="Ne plus proposer"
            (click)="installation.memoriserRefus()">
            <nl-icon name="close" [size]="18" />
          </button>
        </div>
      }

      <router-outlet />
    </div>
  `,
  styleUrl: './app-shell-root.scss',
})
export class AppShellRoot {
  protected readonly theme = inject(ThemeService);
  protected readonly reseau = inject(ReseauService);
  protected readonly installation = inject(InstallationService);

  private readonly maj = inject(MiseAJourService);
  protected readonly majDisponible = this.maj.disponible;

  private readonly auth = inject(AuthService);
  private readonly notifications = inject(PreferenceNotifications);
  private pushRebranche = false;

  constructor() {
    // Le canal push se rebranche une fois la session ouverte, et une seule
    // fois : la permission n'est jamais redemandée ici — seul l'interrupteur
    // des réglages la réclame, parce qu'une autorisation demandée à
    // l'ouverture est une autorisation refusée.
    effect(() => {
      if (this.pushRebranche || !estAuthentifie(this.auth.state())) return;
      this.pushRebranche = true;
      void this.notifications.rebrancher();
    });
  }

  protected appliquerMaj(): void {
    void this.maj.appliquer();
  }

  protected async installer(): Promise<void> {
    await this.installation.proposer();
  }
}
