import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { tr } from '../../core/i18n';
import { TraductionPipe } from '../../core/i18n';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { HapticService } from '../../shared/services/haptic';
import { IconName } from '../../shared/ui/icon/icon-paths';
import { ContexteService } from '../../core/contexte';
import { StockageHorsLigne } from '../../core/bibliotheque';

interface Onglet {
  readonly route: string;
  readonly label: string;
  readonly icon: IconName;
  readonly iconActif: IconName;
  /** Nombre à afficher en pastille, s'il y a lieu. Lu à chaque rendu. */
  readonly compte?: () => number;
}

/**
 * La coque à cinq onglets - traduction de `MainShell`/`NextLearnBottomNavBar`
 * (`lib/layout/main_shell/`). L'état de chaque onglet est préservé par
 * `TabReuseStrategy` (Phase 3), pas par ce composant : revenir sur la
 * bibliothèque après un détour par le profil retrouve son défilement.
 * `routerLinkActive` fait ce que `currentIndex` faisait côté Flutter -
 * dire quel onglet est actif, sans qu'il faille le traquer à la main.
 *
 * **Le geste de retour qui ramène au premier onglet puis demande
 * confirmation avant de fermer l'application n'a pas d'équivalent ici** -
 * voir `AUDIT_PHASE1.md`, §6 : le bouton retour du navigateur gère
 * l'historique, pas la fermeture d'une application. Le reproduire
 * piégerait l'utilisateur sur un geste qui, sur le web, veut juste dire
 * « page précédente ».
 */
@Component({
  selector: 'app-main-shell',
  standalone: true,
  imports: [TraductionPipe, RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './main-shell.html',
  styleUrl: './main-shell.scss',
})
export class MainShell {
  private readonly haptic = inject(HapticService);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly contexte = inject(ContexteService);

  constructor() {
    // L'inventaire local alimente la pastille de l'onglet Bibliothèque :
    // savoir combien de documents sont réellement lisibles sans réseau est
    // la première chose qu'on vérifie avant un trajet.
    void this.stockage.rafraichir();
  }

  /** L'ordre suit celui des branches du routeur - un décalage ici
   * enverrait l'onglet « Profil » sur la page des dépôts. */
  private readonly toutesLesOnglets: readonly (Onglet & { fonction?: string })[] = [
    { route: 'home', label: tr('navAccueil', 'Accueil'), icon: 'home_outline', iconActif: 'home' },
    {
      route: 'bibliotheque',
      label: tr('navBibliotheque', 'Bibliothèque'),
      icon: 'library_books',
      iconActif: 'library_books_fill',
      compte: () => this.stockage.ids().size,
    },
    { route: 'progression', fonction: 'stats', label: tr('navProgression', 'Progression'), icon: 'monitoring_outline', iconActif: 'monitoring' },
    { route: 'depots', fonction: 'contributions', label: tr('navContribution', 'Contribution'), icon: 'upload_file_outline', iconActif: 'upload_file' },
    { route: 'profil', label: tr('navProfil', 'Profil'), icon: 'person', iconActif: 'person_fill' },
  ];

  /** Les onglets, moins ceux que l'administration a fermés. */
  protected readonly onglets = computed(() =>
    this.toutesLesOnglets.filter((o) => !o.fonction || !this.contexte.fonctionnaliteFermee(o.fonction)),
  );

  protected surTap(): void {
    this.haptic.leger();
  }
}
