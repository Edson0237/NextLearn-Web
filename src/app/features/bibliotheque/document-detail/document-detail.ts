import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { tr } from '../../../core/i18n/traduction.service';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Badge } from '../../../shared/ui/badge/badge';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { FavorisRepository } from '../../../core/bibliotheque';
import { OfflineRepository } from '../../../core/bibliotheque';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { SignalementFlux } from '../../../shared/ui/signalement/signalement-flux';
import { CibleSignalement } from '../../../core/moderation/report.model';
import { ContexteService } from '../../../core/contexte/contexte.service';
import { HistoriqueNavigation } from '../../../core/router/historique-navigation';
import { LienProfond } from '../../../core/partage/lien-profond';
import {
  DocumentModel,
  DocumentType,
  } from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router/app-routes';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

@Component({
  selector: 'nl-document-detail',
  standalone: true,
  imports: [TypeDocumentPipe, TraductionPipe, CommonModule, Icon, Badge, PageBar, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-detail.html',
  styleUrl: './document-detail.scss',
})
export class DocumentDetail implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly favorisRepo = inject(FavorisRepository);
  private readonly offlineRepo = inject(OfflineRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly signalement = inject(SignalementFlux);
  private readonly historique = inject(HistoriqueNavigation);
  private readonly contexteService = inject(ContexteService);
  /** Le hors ligne, quand l'administration ne l'a pas fermé. */
  protected readonly horsLigneOuvert = computed(() => !this.contexteService.fonctionnaliteFermee('offline'));
  private readonly toast = inject(ToastService);
  private readonly selections = inject(FeuilleSelectionService);
  private readonly actions = inject(FeuilleActionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly document = signal<DocumentModel | null>(null);
  protected readonly isFavori = signal(false);
  protected readonly isOffline = signal(false);
  /** Téléchargement du fichier en cours pour la mise hors ligne. */
  protected readonly miseHorsLigne = signal(false);
  /** Vrai pendant la préparation du téléchargement (URL signée + ouverture). */
  protected readonly telechargement = signal(false);
  /** La note que cet étudiant vient de donner, 0 s'il n'a pas encore noté. */
  protected readonly noteDonnee = signal(0);

  private docId = '';

  async ngOnInit(): Promise<void> {
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [doc, favoris, offlineIds] = await Promise.all([
        this.docsRepo.getById(this.docId),
        this.favorisRepo.getFavorites().catch(() => []),
        this.offlineRepo.getOfflineIds().catch(() => new Set<string>()),
      ]);
      this.document.set(doc);
      this.isFavori.set(favoris.some((f) => f.id === this.docId));
      // Deux sources, et c'est voulu : le serveur dit ce que l'étudiant a
      // marqué depuis n'importe quel appareil, le cache local dit ce qui est
      // réellement lisible sur celui-ci.
      await this.stockage.rafraichir();
      this.isOffline.set(offlineIds.has(this.docId) || this.stockage.ids().has(this.docId));
      if (doc) void this.docsRepo.recordView(doc.id);
    } catch {
      this.error.set('Impossible de charger ce document.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    // La pile des écrans visités, et non `Location.back()` : on arrive ici
    // depuis l'accueil, la bibliothèque, une matière, les favoris ou un lien
    // partagé, et chacun mérite qu'on y revienne - sans repasser par le
    // lecteur dont on vient peut-être (voir `HistoriqueNavigation`).
    this.historique.retour('/app/' + AppRoutes.bibliotheque, (url) => url.endsWith('/read'));
  }

  protected openDocument(): void {
    const doc = this.document();
    if (!doc) return;
    void this.router.navigateByUrl('/app/' + AppRoutes.docReaderPath(doc.id));
  }

  /**
   * Partage le lien canonique, celui que l'application mobile sait rouvrir.
   *
   * `window.location.href` était partagé jusqu'ici : une URL de la PWA, qu'un
   * téléphone équipé de l'application ouvrait dans son navigateur au lieu de
   * la fiche. Les deux plateformes produisent désormais le même lien.
   */
  protected async share(): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    const url = LienProfond.document(doc.id);
    const texte = `Regarde ce document sur NextLearn :\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: doc.titre, text: texte, url });
      } catch {
        // Partage refusé ou annulé : rien à signaler, ce n'est pas une panne.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toast.succes(tr('pwaLienCopie', 'Lien copié.'));
    } catch {
      this.toast.erreur(tr('pwaCopieLienImpossible', 'Impossible de copier le lien.'));
    }
  }

  protected async toggleFavori(): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    const avant = this.isFavori();
    // Bascule optimiste : le cœur réagit au doigt, pas au réseau. En cas
    // d'échec il revient en place et l'erreur est dite.
    this.isFavori.set(!avant);
    try {
      if (avant) await this.favorisRepo.removeFavorite(doc.id);
      else await this.favorisRepo.addFavorite(doc.id);
    } catch {
      this.isFavori.set(avant);
      this.toast.erreur(tr('pwaFavoriNonEnregistre', 'Le favori n’a pas pu être enregistré.'));
    }
  }

  /**
   * Rend le document lisible sans réseau.
   *
   * Deux gestes en un, et il en manquait un : marquer côté serveur (pour
   * retrouver sa liste d'un appareil à l'autre) **et** télécharger le fichier
   * ici. Seul le premier existait : la « bibliothèque hors ligne » exigeait
   * donc une connexion pour s'afficher, et ne contenait rien à lire.
   */
  protected async toggleOffline(): Promise<void> {
    const doc = this.document();
    if (!doc || this.miseHorsLigne()) return;

    if (this.isOffline()) {
      const confirme = await this.actions.confirmer({
        title: tr('pwaRetirerHorsLigneQuestion', 'Retirer du hors ligne ?'),
        description: tr('pwaPlusConsultableSansConnexion', 'Le document ne sera plus consultable sans connexion.'),
        confirmLabel: tr('docRetirer', 'Retirer'),
        cancelLabel: tr('actionAnnuler', 'Annuler'),
        destructive: true,
      });
      if (!confirme) return;
      try {
        await this.stockage.supprimer(doc.id);
        await this.offlineRepo.removeOffline(doc.id);
        this.isOffline.set(false);
      } catch {
        this.toast.erreur(tr('pwaRetraitEchoue', 'Le retrait a échoué.'));
      }
      return;
    }

    this.miseHorsLigne.set(true);
    try {
      const url = (await this.docsRepo.urlLecture(doc.id)) ?? doc.urlPdf;
      const enregistre = url ? await this.stockage.enregistrer(doc.id, url) : false;
      if (enregistre) await this.stockage.enregistrerFiche(doc.id, doc);
      await this.offlineRepo.markOffline(doc.id);
      this.isOffline.set(true);
      this.toast.succes(
        enregistre
          ? 'Disponible hors ligne.'
          : 'Ajouté à ta liste. Le fichier sera téléchargé à la prochaine ouverture.',
      );
    } catch {
      this.toast.erreur(tr('pwaMiseHorsLigneEchouee', 'La mise hors ligne a échoué.'));
    } finally {
      this.miseHorsLigne.set(false);
    }
  }

  /**
   * Télécharge le document.
   *
   * L'action manquait entièrement : `recordDownload` existait dans le dépôt
   * mais aucun écran ne l'appelait. Le fichier passe par une URL signée -
   * jamais par l'URL brute de stockage, qui serait réutilisable sans compte.
   */
  protected async telecharger(): Promise<void> {
    const doc = this.document();
    if (!doc || this.telechargement()) return;
    this.telechargement.set(true);
    try {
      const url = (await this.docsRepo.urlLecture(doc.id)) ?? doc.urlPdf;
      if (!url) {
        this.toast.erreur(tr('pwaPasDeFichierAssocie', 'Ce document n’a pas de fichier associé.'));
        return;
      }
      void this.docsRepo.recordDownload(doc.id);
      const lien = window.document.createElement('a');
      lien.href = url;
      lien.download = `${doc.titre}.pdf`;
      lien.rel = 'noopener';
      lien.target = '_blank';
      lien.click();
    } catch {
      this.toast.erreur(tr('telechargementEchecSimple', 'Le téléchargement a échoué.'));
    } finally {
      this.telechargement.set(false);
    }
  }

  /**
   * Note le document, de 1 à 5.
   *
   * Les cinq étoiles étaient cinq lignes dans une feuille de sélection, parce
   * qu'une étoile de 20 px est sous le seuil tactile. Elles sont revenues en
   * rangée, mais avec une cible de 44 px chacune et une icône dessinée -
   * `★`/`☆` étaient des caractères, dont le rendu change d'un appareil à
   * l'autre et que les lecteurs d'écran épellent.
   */
  protected async noter(valeur: number): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    const avant = this.noteDonnee();
    this.noteDonnee.set(valeur);
    try {
      await this.docsRepo.rate(doc.id, valeur);
      this.toast.succes(tr('pwaNoteEnregistree', 'Merci, ta note est enregistrée.'));
      await this.load();
    } catch {
      this.noteDonnee.set(avant);
      this.toast.erreur(tr('pwaNoteNonEnregistree', 'La note n’a pas pu être enregistrée.'));
    }
  }

  protected signaler(): Promise<void> {
    const doc = this.document();
    return doc ? this.signalement.signaler(CibleSignalement.document, doc.id) : Promise.resolve();
  }

  /** Remonte à la matière d'où sort le document, via le fil d'ariane. */
  protected openMatiere(doc: DocumentModel): void {
    void this.router.navigateByUrl(
      doc.matiereId
        ? '/app/' + AppRoutes.matierePath(doc.matiereId)
        : '/app/' + AppRoutes.bibliotheque,
    );
  }




}
