import { NotificationsEtat } from '../../../core/notifications';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Badge } from '../../../shared/ui/badge/badge';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { FavorisRepository } from '../../../core/bibliotheque';
import { OfflineRepository } from '../../../core/bibliotheque';
import { StockageHorsLigne, formaterTailleOctets, InfoDocumentLocal } from '../../../core/bibliotheque';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { SignalementFlux } from '../../../shared/ui/signalement/signalement-flux';
import { CibleSignalement } from '../../../core/moderation';
import { HistoriqueNavigation } from '../../../core/router';
import {
  DocumentModel,
  DocumentType,
  } from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router';
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
  protected readonly telechargements = inject(TelechargementEtat);
  private readonly notifEtat = inject(NotificationsEtat);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly favorisRepo = inject(FavorisRepository);
  private readonly offlineRepo = inject(OfflineRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly signalement = inject(SignalementFlux);
  private readonly historique = inject(HistoriqueNavigation);
  private readonly toast = inject(ToastService);
  private readonly selections = inject(FeuilleSelectionService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly document = signal<DocumentModel | null>(null);
  protected readonly isFavori = signal(false);
  protected readonly isOffline = signal(false);
  /** La note que cet étudiant vient de donner, 0 s'il n'a pas encore noté. */
  protected readonly noteDonnee = signal(0);

  private docId = '';

  async ngOnInit(): Promise<void> {
    void this.telechargements.initialiser();
    this.docId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    await this.stockage.rafraichir();
    try {
      const [doc, favoris, offlineIds] = await Promise.all([
        this.docsRepo.getDocumentDetails(this.docId).catch(() => null),
        this.favorisRepo.getFavorites().catch(() => []),
        this.offlineRepo.getOfflineIds().catch(() => new Set<string>()),
      ]);
      const docFinal = doc ?? (await this.docsRepo.getOfflineDocument(this.docId)) ?? null;
      this.document.set(docFinal);
      this.isFavori.set(favoris.some((f) => f.id === this.docId));
      // Deux sources, et c'est voulu : le serveur dit ce que l'étudiant a
      // marqué depuis n'importe quel appareil, le cache local dit ce qui est
      // réellement lisible sur celui-ci.
      this.isOffline.set(offlineIds.has(this.docId) || this.stockage.ids().has(this.docId));
      if (docFinal) {
        void this.docsRepo.recordView(docFinal.id);
        // Consulté : les notifications qui l'annonçaient ne sont plus « nouvelles ».
        void this.notifEtat.marquerRessourceLue('document', docFinal.id);
      }
    } catch {
      const repliLocal = await this.docsRepo.getOfflineDocument(this.docId);
      if (repliLocal) {
        this.document.set(repliLocal);
        this.isOffline.set(true);
      } else {
        this.error.set('Impossible de charger ce document.');
      }
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

  protected readonly chargementLecture = signal(false);

  protected openDocument(): void {
    const doc = this.document();
    if (!doc) return;
    this.chargementLecture.set(true);
    void this.router.navigateByUrl('/app/' + AppRoutes.docReaderPath(doc.id));
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

  protected async telecharger(): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    await this.telechargements.telecharger(doc);
    this.isOffline.set(this.stockage.ids().has(doc.id));
  }

  protected async supprimerDuStockageLocal(): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    await this.telechargements.supprimer(doc.id);
    this.isOffline.set(this.stockage.ids().has(doc.id));
  }

  protected infoLocale(id: string): InfoDocumentLocal | null {
    return this.stockage.infoDocument(id);
  }

  protected tailleLocaleFormatee(id: string): string {
    const info = this.stockage.infoDocument(id);
    return info ? formaterTailleOctets(info.tailleOctets) : '';
  }

  protected ouvrirMesTelechargements(): void {
    void this.router.navigate(['/app', AppRoutes.offlineLibrary]);
  }

  protected iconeTelechargement(id: string): IconName {
    switch (this.telechargements.etat(id)) {
      case 'fait': return 'check_circle';
      case 'encours': return 'sync';
      default: return 'download';
    }
  }

  protected libelleTelechargement(id: string): string {
    switch (this.telechargements.etat(id)) {
      case 'fait': return tr('dlEnregistreHorsLigne', 'Enregistré hors ligne');
      case 'encours': {
        const pct = this.telechargements.progression(id);
        return pct > 0 ? `${pct} %` : tr('chargementEnCours', 'Chargement…');
      }
      case 'lance': return tr('dlLanceCourt', 'Téléchargement lancé');
      default: return tr('actionTelecharger', 'Télécharger');
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
