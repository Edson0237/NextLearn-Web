import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EpreuvesRepository } from '../../../core/epreuves/epreuves-repository';
import { EpreuveModel, TypeEpreuve } from '../../../core/epreuves/epreuve.model';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { Failure } from '../../../core/models/failure.model';
import { AppRoutes } from '../../../core/router/app-routes';

/**
 * Détail d'une épreuve — traduction d'`EpreuveDetailPage`
 * (`lib/domains/epreuves/presentation/pages/epreuve_detail/epreuve_detail_page.dart`).
 *
 * **Le PDF s'ouvre dans un nouvel onglet (`window.open`), pas dans un
 * lecteur intégré** : le lecteur embarqué (suivi de progression de
 * lecture, zoom, pagination) est un morceau d'architecture partagé avec
 * la fiche document de la bibliothèque — PARITY_MATRIX §3 le signale
 * déjà comme le risque le plus notable du portage, sans équivalent direct
 * à Syncfusion. Le construire pour cette seule page, avant la décision
 * prise pour la bibliothèque, serait le construire deux fois. Le
 * navigateur rend déjà un PDF nativement dans un nouvel onglet — ce que
 * cet écran demande vraiment : voir le sujet, pas le lire en place.
 */
@Component({
  selector: 'app-epreuve-detail',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epreuve-detail.html',
  styleUrl: './epreuve-detail.scss',
})
export class EpreuveDetail {
  protected readonly TypeEpreuve = TypeEpreuve;

  private readonly repo = inject(EpreuvesRepository);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statut = signal<'chargement' | 'pret' | 'erreur' | 'introuvable'>('chargement');
  protected readonly erreur = signal('');
  protected readonly epreuve = signal<EpreuveModel | undefined>(undefined);
  protected readonly telechargementEnCours = signal<'epreuve' | 'corrige' | undefined>(undefined);

  protected readonly noteChoisie = signal(0);
  protected readonly envoiNote = signal(false);
  protected readonly noteEnvoyee = signal(false);

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.statut.set('chargement');
    try {
      const ep = await this.repo.getById(this.id);
      if (!ep) {
        this.statut.set('introuvable');
        return;
      }
      this.epreuve.set(ep);
      this.statut.set('pret');
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Erreur de chargement.');
      this.statut.set('erreur');
    }
  }

  protected async ouvrirPdf(type: 'epreuve' | 'corrige'): Promise<void> {
    const ep = this.epreuve();
    if (!ep || this.telechargementEnCours()) return;
    this.telechargementEnCours.set(type);
    try {
      const url = await this.repo.getDownloadUrl(ep.id, type);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Téléchargement impossible.');
    } finally {
      this.telechargementEnCours.set(undefined);
    }
  }

  protected choisirNote(n: number): void {
    if (this.envoiNote()) return;
    this.noteChoisie.set(n);
    this.noteEnvoyee.set(false);
  }

  protected async envoyerNote(): Promise<void> {
    const ep = this.epreuve();
    if (!ep || this.noteChoisie() === 0 || this.envoiNote()) return;
    this.envoiNote.set(true);
    try {
      await this.repo.rate(ep.id, this.noteChoisie());
      this.noteEnvoyee.set(true);
      this.toast.succes('Merci pour ta note !');
      void this.charger();
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible.');
    } finally {
      this.envoiNote.set(false);
    }
  }

  protected retour(): void {
    void this.router.navigate(['/app', AppRoutes.epreuves]);
  }
}
