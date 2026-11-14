import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../../shared/services/theme';
import { OfflineBanner } from '../../shared/ui/offline-banner/offline-banner';
import { Icon } from '../../shared/ui/icon/icon';
import { TraductionPipe } from '../../core/i18n';
import { GuideInstallation } from '../../shared/ui/guide-installation/guide-installation';
import { ReseauService } from '../../core/network';
import { MiseAJourService } from '../../core/pwa';
import { InstallationService } from '../../core/pwa';
import { AuthService } from '../../core/auth';
import { PreferenceNotifications } from '../../core/notifications';
import { estAuthentifie } from '../../core/auth';

/**
 * Racine de toute l'application sous `/app` - le point d'entrée des styles
 * d'application que `design-catalog.ts` annonçait devoir déplacer ici une
 * fois la coque existante (Phase 2 → Phase 3). Posée comme `component` de
 * la route wrapper dans `app-shell.routes.ts` : tout écran (splash,
 * onboarding, `MainShell`…) rend à l'intérieur de son `<router-outlet>` et
 * hérite donc de `.nl-app` par ascendance DOM, qu'il porte ou non la classe
 * lui-même - exactement ce que `App` ne pouvait pas garantir à sa propre
 * racine, puisqu'il sert aussi la vitrine (voir `fatal-error.ts`).
 *
 * C'est aussi le seul endroit qui voit tous les écrans à la fois : les trois
 * bandeaux d'état de l'application (réseau coupé, nouvelle version, invitation
 * à installer) vivent ici plutôt que recopiés dans chacun.
 */
@Component({
  selector: 'app-shell-root',
  standalone: true,
  imports: [RouterOutlet, OfflineBanner, Icon, TraductionPipe, GuideInstallation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-app" [attr.data-theme]="theme.attribute()">
      @if (!reseau.enLigne()) {
        <nl-offline-banner />
      }

      @if (majDisponible()) {
        <div class="nl-bandeau nl-bandeau--maj" role="status" aria-live="polite">
          <nl-icon name="refresh" [size]="18" />
          <span class="nl-bandeau__texte">Une nouvelle version est disponible.</span>
          <button type="button" class="nl-bandeau__action" [disabled]="majEnCours()" (click)="appliquerMaj()">
            Mettre à jour
          </button>
        </div>
      }

      @if (installation.bandeauVisible() && !guideOuvert()) {
        <div class="nl-bandeau" role="status">
          <nl-icon name="download" [size]="18" />
          @if (installation.peutProposer()) {
            <span class="nl-bandeau__texte">{{ 'installBandeauTexte' | t }}</span>
            <button type="button" class="nl-bandeau__action" (click)="installer()">
              {{ 'installBandeauAction' | t }}
            </button>
          } @else {
            <span class="nl-bandeau__texte">{{ 'installBandeauTexteGuide' | t }}</span>
            <button type="button" class="nl-bandeau__action" (click)="guideOuvert.set(true)">
              {{ 'installBandeauVoir' | t }}
            </button>
          }
          <button
            type="button"
            class="nl-bandeau__fermer"
            [attr.aria-label]="'installBandeauFermer' | t"
            (click)="installation.memoriserRefus()">
            <nl-icon name="close" [size]="18" />
          </button>
        </div>
      }

      @if (guideOuvert()) {
        <div class="nl-feuille-guide" role="dialog" aria-modal="true" [attr.aria-label]="'installReglageTitre' | t">
          <div class="nl-feuille-guide__corps">
            <button
              type="button"
              class="nl-bandeau__fermer nl-feuille-guide__fermer"
              [attr.aria-label]="'installFermerGuide' | t"
              (click)="guideOuvert.set(false)">
              <nl-icon name="close" [size]="20" />
            </button>
            <nl-guide-installation />
          </div>
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

  /** Le guide d'installation, ouvert depuis le bandeau (sans quitter l'écran en cours). */
  protected readonly guideOuvert = signal(false);

  private readonly maj = inject(MiseAJourService);
  protected readonly majDisponible = this.maj.disponible;
  protected readonly majEnCours = this.maj.rechargementEnCours;

  private readonly auth = inject(AuthService);
  private readonly notifications = inject(PreferenceNotifications);
  private pushRebranche = false;

  constructor() {
    // Le canal push se rebranche une fois la session ouverte, et une seule
    // fois : la permission n'est jamais redemandée ici - seul l'interrupteur
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
