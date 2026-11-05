import {
  metaDocument,
  noteDocument,
  formaterTailleOctets,
  InfoDocumentLocal,
} from '../../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocumentCard, EtiquetteDocument } from '../../../shared/ui/document-card/document-card';
import { Icon } from '../../../shared/ui/icon/icon';
import { SearchBar } from '../../../shared/ui/search-bar/search-bar';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { SectionHeader } from '../../../shared/ui/section-header/section-header';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { OfflineRepository } from '../../../core/bibliotheque';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { FavorisRepository } from '../../../core/bibliotheque';
import {
  LectureProgress,
  LectureProgressRepository,
} from '../../../core/bibliotheque';
import {
  DocumentModel,
} from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

/** Les trois façons de retrouver un document qu'on a déjà croisé. */
type Onglet = 'telecharges' | 'favoris' | 'historique';

@Component({
  selector: 'nl-offline-library',
  standalone: true,
  imports: [
    TypeDocumentPipe,
    CascadeEnter,
    TraductionPipe,
    CommonModule,
    DocumentCard,
    Icon,
    SearchBar,
    SectionHeader,
    EmptyState,
    PageBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-library.html',
  styleUrl: './offline-library.scss',
})
export class OfflineLibrary implements OnInit {
  private readonly router = inject(Router);
  private readonly offlineRepo = inject(OfflineRepository);
  protected readonly stockage = inject(StockageHorsLigne);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly favorisRepo = inject(FavorisRepository);
  private readonly lectures = inject(LectureProgressRepository);
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly offlineIds = signal<Set<string>>(new Set());
  protected readonly favoris = signal<DocumentModel[]>([]);
  protected readonly progression = signal<Map<string, LectureProgress>>(new Map());
  /** Place occupée et place totale, en octets, telles que le navigateur et IndexedDB les estiment. */
  protected readonly stockageUtilise = signal<number | null>(null);
  protected readonly stockageTotal = signal<number | null>(null);
  protected readonly stockageApp = signal<number>(0);

  protected readonly onglet = signal<Onglet>('telecharges');
  protected readonly recherche = signal('');

  protected readonly offlineDocuments = computed(() => {
    const ids = this.offlineIds();
    const parId = new Map<string, DocumentModel>();
    for (const d of this.documents()) {
      if (ids.has(d.id)) parId.set(d.id, d);
    }
    for (const fiche of this.stockage.fiches()) {
      if (!parId.has(fiche.id)) {
        parId.set(fiche.id, fiche);
      }
    }
    return [...parId.values()];
  });

  /** Ce qu'on a ouvert, du plus récent au plus ancien. */
  protected readonly lus = computed(() => {
    const avancement = this.progression();
    return this.documents()
      .filter((d) => avancement.has(d.id))
      .sort(
        (a, b) =>
          Date.parse(avancement.get(b.id)!.derniereLecture) -
          Date.parse(avancement.get(a.id)!.derniereLecture),
      );
  });

  protected readonly liste = computed(() => {
    const base =
      this.onglet() === 'favoris'
        ? this.favoris()
        : this.onglet() === 'historique'
          ? this.lus()
          : this.offlineDocuments();
    const q = this.recherche().trim().toLowerCase();
    if (!q) return base;
    return base.filter((d) => `${d.titre} ${d.matiere}`.toLowerCase().includes(q));
  });

  /** Remplissage de la jauge, en pourcentage. */
  protected readonly pourcentageStockage = computed(() => {
    const utilise = this.stockageUtilise();
    const total = this.stockageTotal();
    if (!utilise || !total) {
      return this.stockage.ids().size > 0 ? 5 : 0;
    }
    return Math.max(2, Math.min(100, Math.round((utilise / total) * 100)));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    await this.stockage.rafraichir();
    const locaux = this.stockage.ids();
    const fichesLocales = this.stockage.fiches();
    await this.mesurerStockage();

    try {
      const [ids, docs, favoris, avancement] = await Promise.all([
        this.offlineRepo.getOfflineIds().catch(() => new Set<string>()),
        this.docsRepo.getDocuments(),
        this.favorisRepo.getFavorites().catch(() => [] as DocumentModel[]),
        this.lectures.getAll().catch(() => new Map<string, LectureProgress>()),
      ]);
      this.offlineIds.set(new Set([...locaux, ...ids]));
      const fusion = new Map<string, DocumentModel>();
      for (const f of fichesLocales) fusion.set(f.id, f);
      for (const d of docs) fusion.set(d.id, d);
      this.documents.set([...fusion.values()]);
      this.favoris.set(favoris);
      this.progression.set(avancement);
    } catch {
      // Hors ligne : les fiches rangées dans IndexedDB avec les fichiers
      // suffisent à dresser la liste complète sans aucun appel réseau.
      const avancementLocal = await this.lectures
        .getAll()
        .catch(() => new Map<string, LectureProgress>());
      this.offlineIds.set(new Set(locaux));
      this.documents.set([...fichesLocales]);
      this.progression.set(avancementLocal);
    } finally {
      this.loading.set(false);
    }
  }

  private async mesurerStockage(): Promise<void> {
    const estimation = await this.stockage.estimation();
    this.stockageUtilise.set(estimation?.utilise ?? null);
    this.stockageTotal.set(estimation?.quota ? estimation.quota : null);
    this.stockageApp.set(estimation?.utiliseApp ?? 0);
  }

  protected goBack(): void {
    void this.router.navigate(['/app', AppRoutes.home]);
  }

  protected choisir(onglet: Onglet): void {
    this.onglet.set(onglet);
  }

  protected compte(onglet: Onglet): number {
    if (onglet === 'favoris') return this.favoris().length;
    if (onglet === 'historique') return this.lus().length;
    return this.offlineDocuments().length;
  }

  protected gererCache(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.parametres);
  }

  /**
   * Action « Libérer de l'espace » : supprime après confirmation explicite
   * les téléchargements locaux de l'utilisateur courant.
   */
  protected async libererEspace(): Promise<void> {
    const nb = this.stockage.ids().size;
    if (nb === 0) return;
    const confirme = await this.actions.confirmer({
      title: tr('pwaLibererEspaceTitre', 'Libérer de l’espace ?'),
      description: `${nb} document${nb > 1 ? 's' : ''} (${this.lisible(this.stockageApp())}) seront retirés du stockage local de cet appareil.`,
      confirmLabel: tr('pwaSupprimerTousLesTelechargements', 'Supprimer mes téléchargements'),
      destructive: true,
    });
    if (!confirme) return;

    const idsLocaux = [...this.stockage.ids()];
    await this.stockage.vider();
    for (const id of idsLocaux) {
      void this.offlineRepo.removeOffline(id).catch(() => undefined);
    }
    this.offlineIds.set(new Set());
    await this.mesurerStockage();
    this.toast.succes(tr('pwaEspaceLibere', 'Espace de stockage libéré.'));
  }

  /**
   * Ouvre directement le document dans le lecteur interne lorsqu'il est
   * disponible hors ligne ou depuis l'onglet « Mes téléchargements ».
   */
  protected openDocument(doc: DocumentModel): void {
    if (this.onglet() === 'telecharges' || this.stockage.ids().has(doc.id)) {
      void this.router.navigateByUrl(
        `/app/${AppRoutes.docReaderPath(doc.id)}?title=${encodeURIComponent(doc.titre)}`,
      );
      return;
    }
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }

  protected async remove(doc: DocumentModel): Promise<void> {
    try {
      await this.stockage.supprimer(doc.id);
      await this.offlineRepo.removeOffline(doc.id).catch(() => undefined);
      const ids = new Set(this.offlineIds());
      ids.delete(doc.id);
      this.offlineIds.set(ids);
      await this.mesurerStockage();
      this.toast.succes(tr('dlRetireHorsLigne', 'Document supprimé du stockage local.'));
    } catch {
      // Silencieux.
    }
  }

  protected infoLocaleDe(doc: DocumentModel): InfoDocumentLocal | null {
    return this.stockage.infoDocument(doc.id);
  }

  /** « Disponible hors ligne » + format (`PDF`/`DOCX`) pour les documents enregistrés dans IndexedDB. */
  protected etiquettesDe(doc: DocumentModel): EtiquetteDocument[] {
    const etiquettes: EtiquetteDocument[] = [{ texte: doc.matiere }];
    const info = this.infoLocaleDe(doc);
    if (info || this.stockage.ids().has(doc.id)) {
      etiquettes.push({
        texte: tr('pwaPretHorsLigne', 'Disponible hors ligne'),
        ton: 'emeraude',
        icone: 'cloud_done',
      });
      if (info?.format) {
        etiquettes.push({
          texte: info.format.toUpperCase(),
          ton: 'primaire',
        });
      }
    }
    return etiquettes;
  }

  /** Fraction lue, pour la jauge sous la carte. */
  protected avancementDe(doc: DocumentModel): number | undefined {
    const p = this.progression().get(doc.id);
    if (!p || p.totalPages <= 0) return undefined;
    return Math.min(1, p.pageCourante / p.totalPages);
  }

  /**
   * Métadonnées de la carte : affiche la taille exacte du fichier stocké
   * dans IndexedDB et la date de téléchargement lorsque disponibles.
   */
  protected metaFor(doc: DocumentModel) {
    const info = this.infoLocaleDe(doc);
    if (info) {
      const dateStr = new Date(info.dateTelechargement).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const meta: { icon: 'description' | 'attach_file' | 'visibility'; label: string }[] = [
        {
          icon: 'attach_file',
          label: formaterTailleOctets(info.tailleOctets),
        },
        {
          icon: 'description',
          label: doc.pages > 0 ? `${doc.pages} p. · ${dateStr}` : `Téléchargé le ${dateStr}`,
        },
      ];
      return meta;
    }
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }

  /** Formate en Ko, Mo ou Go selon la taille réelle. */
  protected lisible(octets: number | null): string {
    if (octets == null || octets <= 0) return '0 Ko';
    if (octets < 1024 * 1024) {
      return formaterTailleOctets(octets);
    }
    const mo = octets / (1024 * 1024);
    if (mo < 1024) return `${mo.toFixed(1).replace('.', ',')} Mo`;
    return `${(mo / 1024).toFixed(1).replace('.', ',')} Go`;
  }
}
