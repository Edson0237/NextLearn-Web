import { NotificationsEtat } from '../../../core/notifications';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { ActivatedRoute, Router } from '@angular/router';
import { EpreuvesRepository } from '../../../core/epreuves';
import { EpreuveModel, TypeEpreuve, typeEpreuveCle } from '../../../core/epreuves';
import { DocumentModel, DocumentType, StockageHorsLigne } from '../../../core/bibliotheque';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { Icon } from '../../../shared/ui/icon/icon';
import { Badge } from '../../../shared/ui/badge/badge';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { ToastService } from '../../../shared/ui/toast/toast';
import { Failure } from '../../../core/models';
import { SignalementFlux } from '../../../shared/ui/signalement/signalement-flux';
import { CibleSignalement } from '../../../core/moderation';
import { AppRoutes } from '../../../core/router';

/**
 * Détail d'une épreuve - traduction d'`EpreuveDetailPage`
 * (`lib/domains/epreuves/presentation/pages/epreuve_detail/epreuve_detail_page.dart`).
 *
 * **Le PDF s'ouvre dans un nouvel onglet (`window.open`), pas dans un
 * lecteur intégré** : le lecteur embarqué (suivi de progression de
 * lecture, zoom, pagination) est un morceau d'architecture partagé avec
 * la fiche document de la bibliothèque - PARITY_MATRIX §3 le signale
 * déjà comme le risque le plus notable du portage, sans équivalent direct
 * à Syncfusion. Le construire pour cette seule page, avant la décision
 * prise pour la bibliothèque, serait le construire deux fois. Le
 * navigateur rend déjà un PDF nativement dans un nouvel onglet - ce que
 * cet écran demande vraiment : voir le sujet, pas le lire en place.
 */
@Component({
  selector: 'app-epreuve-detail',
  standalone: true,
  imports: [TraductionPipe, Icon, Badge, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epreuve-detail.html',
  styleUrl: './epreuve-detail.scss',
})
export class EpreuveDetail {
  protected readonly TypeEpreuve = TypeEpreuve;
  protected readonly typeCle = typeEpreuveCle;

  protected readonly telechargements = inject(TelechargementEtat);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly repo = inject(EpreuvesRepository);
  private readonly toast = inject(ToastService);
  private readonly signalement = inject(SignalementFlux);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statut = signal<'chargement' | 'pret' | 'erreur' | 'introuvable'>('chargement');
  protected readonly erreur = signal('');
  protected readonly epreuve = signal<EpreuveModel | undefined>(undefined);
  protected readonly telechargementEnCours = signal<'epreuve' | 'corrige' | undefined>(undefined);

  protected readonly noteChoisie = signal(0);
  protected readonly noteSurvolee = signal(0);
  protected readonly envoiNote = signal(false);
  protected readonly noteEnvoyee = signal(false);

  protected signaler(): Promise<void> {
    return this.signalement.signaler(CibleSignalement.epreuve, this.id);
  }

  private readonly notifEtat = inject(NotificationsEtat);

  constructor() {
    void this.telechargements.initialiser();
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.statut.set('chargement');
    await this.stockage.rafraichir();
    try {
      const ep = await this.repo.getById(this.id);
      if (!ep) {
        this.statut.set('introuvable');
        return;
      }
      this.epreuve.set(ep);
      this.statut.set('pret');
      // Consultée : les notifications qui l'annonçaient ne sont plus « nouvelles ».
      void this.notifEtat.marquerRessourceLue('epreuve', this.id);
    } catch (e) {
      const localDoc = this.stockage.infoDocument(this.id)?.document;
      if (localDoc) {
        this.epreuve.set({
          id: localDoc.id,
          matiere: localDoc.matiere,
          annee: Number(localDoc.anneeAcademique?.slice(0, 4)) || new Date().getFullYear(),
          universite: localDoc.universite,
          niveau: localDoc.niveau,
          dureeMinutes: localDoc.dureeMinutes,
          anneeAcademique: localDoc.anneeAcademique,
          avecCorrige: localDoc.avecCorrige,
          urlPdf: localDoc.urlPdf,
          urlCorrigePdf: localDoc.urlCorrigePdf,
          matiereId: localDoc.matiereId,
          universiteId: localDoc.universiteId,
          semestre: localDoc.semestre,
          universel: false,
          vues: localDoc.vues,
          telechargements: localDoc.telechargements,
          noteMoyenne: localDoc.noteMoyenne,
        });
        this.statut.set('pret');
        return;
      }
      this.erreur.set(e instanceof Failure ? e.message : 'Erreur de chargement.');
      this.statut.set('erreur');
    }
  }

  private versDocumentModel(ep: EpreuveModel, urlFinale?: string): DocumentModel {
    return {
      id: ep.id,
      titre: `Épreuve de ${ep.matiere} (${ep.anneeAcademique ?? ep.annee})`,
      description: ep.enseigne ? `Institution : ${ep.enseigne}` : '',
      type: DocumentType.epreuve,
      matiere: ep.matiere,
      enseignant: ep.enseigne ?? 'Non renseigné',
      universite: ep.universite,
      niveau: ep.niveau,
      semestre: ep.semestre,
      dureeMinutes: ep.dureeMinutes,
      avecCorrige: ep.avecCorrige,
      urlCorrigePdf: ep.urlCorrigePdf,
      anneeAcademique: ep.anneeAcademique ?? String(ep.annee),
      tailleMb: 0,
      pages: 0,
      urlPdf: urlFinale ?? ep.urlPdf,
      dateAjout: new Date(),
      vues: ep.vues,
      telechargements: ep.telechargements,
      noteMoyenne: ep.noteMoyenne,
      matiereId: ep.matiereId,
      universiteId: ep.universiteId,
    };
  }

  protected async ouvrirPdf(type: 'epreuve' | 'corrige'): Promise<void> {
    const ep = this.epreuve();
    if (!ep || this.telechargementEnCours()) return;

    if (type === 'epreuve' && this.stockage.ids().has(ep.id)) {
      await this.router.navigateByUrl(
        `/app/${AppRoutes.docReaderPath(ep.id)}?title=${encodeURIComponent(ep.matiere)}`,
      );
      return;
    }

    this.telechargementEnCours.set(type);
    try {
      const url = await this.repo.getDownloadUrl(ep.id, type);
      const titre = type === 'corrige' ? `Corrigé - ${ep.matiere}` : ep.matiere;
      await this.router.navigateByUrl(
        `/app/${AppRoutes.docReaderPath(ep.id)}?title=${encodeURIComponent(titre)}&url=${encodeURIComponent(url)}`,
      );
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Ouverture impossible.');
    } finally {
      this.telechargementEnCours.set(undefined);
    }
  }

  protected async telechargerHorsLigne(): Promise<void> {
    const ep = this.epreuve();
    if (!ep) return;
    try {
      const url =
        this.stockage.ids().has(ep.id)
          ? ep.urlPdf
          : await this.repo.getDownloadUrl(ep.id, 'epreuve').catch(() => ep.urlPdf);
      await this.telechargements.telecharger(this.versDocumentModel(ep, url));
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Téléchargement impossible.');
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
      this.toast.succes(tr('docMerciNote', 'Merci pour ta note !'));
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
