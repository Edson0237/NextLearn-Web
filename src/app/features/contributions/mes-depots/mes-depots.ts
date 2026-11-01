import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { DepotRepository } from '../../../core/contributions';
import { Depot, DepotStatut, libelleDepotStatut } from '../../../core/contributions';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';
import { Refreshable } from '../../../shared/ui/refreshable/refreshable';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Failure } from '../../../core/models';
import { AppRoutes } from '../../../core/router';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { AuthService } from '../../../core/auth';
import { libelleNiveau } from '../../../core/models';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';

/** Une tranche de la barre de répartition : un statut, son compte, sa part. */
export interface TrancheStatut {
  readonly statut: DepotStatut;
  readonly libelle: string;
  readonly icone: IconName;
  readonly nombre: number;
  /** Part du total, en pourcentage. */
  readonly part: number;
}

/**
 * Suivi des dépôts - traduction de `MesDepotsPage`
 * (`lib/domains/contributions/presentation/pages/mes_depots_page.dart`).
 * Existe pour une raison précise : un dépôt met du temps à être relu ;
 * sans cet écran, impossible de distinguer « en attente » de « perdu ».
 */
@Component({
  selector: 'app-mes-depots',
  standalone: true,
  imports: [TraductionPipe, EmptyState, DocumentSkeleton, Refreshable, Icon, AppHeader, AnimatedNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mes-depots.html',
  styleUrl: './mes-depots.scss',
})
export class MesDepots {
  private readonly router = inject(Router);
  private readonly repo = inject(DepotRepository);
  private readonly auth = inject(AuthService);

  protected readonly user = computed(() => this.auth.state().user);

  /** L'école et le niveau, pour la puce de contexte de l'en-tête. */
  protected readonly cursus = computed(() => {
    const u = this.user();
    if (!u) return undefined;
    return [u.universite, libelleNiveau(u.niveau)].filter(Boolean).join(' • ');
  });

  protected readonly DepotStatut = DepotStatut;
  protected readonly libelleDepotStatut = libelleDepotStatut;

  protected readonly depots = signal<Depot[]>([]);
  protected readonly statut = signal<'chargement' | 'pret' | 'erreur'>('chargement');
  protected readonly erreur = signal('');
  protected readonly rafraichissement = signal(false);

  /**
   * La répartition par statut, dans l'ordre du parcours d'un dépôt :
   * déposé, relu, puis publié ou refusé.
   *
   * L'écran ne montrait qu'une liste à plat. Un dépôt met des jours à être
   * relu : sans cette vue d'ensemble, impossible de voir d'un coup d'œil
   * combien attendent, combien sont passés, et combien ont été refusés.
   */
  protected readonly tranches = computed<TrancheStatut[]>(() => {
    const tous = this.depots();
    const total = tous.length;
    const ordre: readonly DepotStatut[] = [
      DepotStatut.publie,
      DepotStatut.enRevue,
      DepotStatut.enAttente,
      DepotStatut.refuse,
    ];
    return ordre
      .map((statut) => {
        const nombre = tous.filter((d) => d.statut === statut).length;
        return {
          statut,
          libelle: libelleDepotStatut(statut),
          icone: this.iconeStatut(statut),
          nombre,
          // Pas d'arrondi au plus proche : trois tranches à 33,3 % en
          // donneraient 99 et laisseraient un creux au bout de la barre.
          part: total > 0 ? (nombre / total) * 100 : 0,
        };
      })
      .filter((tr) => tr.nombre > 0);
  });

  protected readonly total = computed(() => this.depots().length);

  /** La part des dépôts publiés, arrondie - le chiffre qui résume l'écran. */
  protected readonly tauxPublies = computed(() => {
    const total = this.total();
    if (total === 0) return 0;
    const publies = this.depots().filter((d) => d.statut === DepotStatut.publie).length;
    return Math.round((publies / total) * 100);
  });

  protected openNotifications(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.notifications);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/app', AppRoutes.favoris]);
  }

  protected openProfil(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.statut.set('chargement');
    try {
      this.depots.set(await this.repo.mesDepots());
      this.statut.set('pret');
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Vérifie ta connexion.');
      this.statut.set('erreur');
    }
  }

  protected async rafraichir(): Promise<void> {
    this.rafraichissement.set(true);
    await this.charger();
    this.rafraichissement.set(false);
  }

  protected scanner(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.depotScanner);
  }

  protected proposer(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }

  protected contester(): void {
    void this.router.navigate(['/app', AppRoutes.recours]);
  }

  protected iconeStatut(s: DepotStatut): IconName {
    switch (s) {
      case DepotStatut.publie: return 'check_circle';
      case DepotStatut.refuse: return 'error';
      case DepotStatut.enRevue: return 'description';
      case DepotStatut.enAttente: return 'info';
    }
  }
}
