import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { HapticService } from '../../shared/services/haptic';
import { IconName } from '../../shared/ui/icon/icon-paths';

interface Onglet {
  readonly route: string;
  readonly label: string;
  readonly icon: IconName;
  readonly iconActif: IconName;
}

/**
 * La coque à cinq onglets — traduction de `MainShell`/`NextLearnBottomNavBar`
 * (`lib/layout/main_shell/`). L'état de chaque onglet est préservé par
 * `TabReuseStrategy` (Phase 3), pas par ce composant : revenir sur la
 * bibliothèque après un détour par le profil retrouve son défilement.
 * `routerLinkActive` fait ce que `currentIndex` faisait côté Flutter —
 * dire quel onglet est actif, sans qu'il faille le traquer à la main.
 *
 * **Le geste de retour qui ramène au premier onglet puis demande
 * confirmation avant de fermer l'application n'a pas d'équivalent ici** —
 * voir `AUDIT_PHASE1.md`, §6 : le bouton retour du navigateur gère
 * l'historique, pas la fermeture d'une application. Le reproduire
 * piégerait l'utilisateur sur un geste qui, sur le web, veut juste dire
 * « page précédente ».
 */
@Component({
  selector: 'app-main-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-shell.html',
  styleUrl: './main-shell.scss',
})
export class MainShell {
  private readonly haptic = inject(HapticService);

  /** L'ordre suit celui des branches du routeur — un décalage ici
   * enverrait l'onglet « Profil » sur la page des dépôts. */
  protected readonly onglets: readonly Onglet[] = [
    { route: 'home', label: 'Accueil', icon: 'home_outline', iconActif: 'home' },
    { route: 'bibliotheque', label: 'Bibliothèque', icon: 'menu_book_outline', iconActif: 'menu_book' },
    { route: 'progression', label: 'Progression', icon: 'monitoring_outline', iconActif: 'monitoring' },
    { route: 'depots', label: 'Contribution', icon: 'upload_file_outline', iconActif: 'upload_file' },
    { route: 'profil', label: 'Profil', icon: 'person', iconActif: 'person_fill' },
  ];

  protected surTap(): void {
    this.haptic.leger();
  }
}
