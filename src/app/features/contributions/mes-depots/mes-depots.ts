import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DepotRepository } from '../../../core/contributions/depot-repository';
import { Depot, DepotStatut, libelleDepotStatut } from '../../../core/contributions/depot.model';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';
import { Refreshable } from '../../../shared/ui/refreshable/refreshable';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Failure } from '../../../core/models/failure.model';
import { AppRoutes } from '../../../core/router/app-routes';

/**
 * Suivi des dépôts — traduction de `MesDepotsPage`
 * (`lib/domains/contributions/presentation/pages/mes_depots_page.dart`).
 * Existe pour une raison précise : un dépôt met du temps à être relu ;
 * sans cet écran, impossible de distinguer « en attente » de « perdu ».
 */
@Component({
  selector: 'app-mes-depots',
  standalone: true,
  imports: [EmptyState, DocumentSkeleton, Refreshable, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mes-depots.html',
  styleUrl: './mes-depots.scss',
})
export class MesDepots {
  private readonly router = inject(Router);
  private readonly repo = inject(DepotRepository);

  protected readonly DepotStatut = DepotStatut;
  protected readonly libelleDepotStatut = libelleDepotStatut;

  protected readonly depots = signal<Depot[]>([]);
  protected readonly statut = signal<'chargement' | 'pret' | 'erreur'>('chargement');
  protected readonly erreur = signal('');
  protected readonly rafraichissement = signal(false);

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

  protected proposer(): void {
    void this.router.navigate(['/app', AppRoutes.depotForm]);
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
