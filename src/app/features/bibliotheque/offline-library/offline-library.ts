import { metaDocument, noteDocument } from '../../../core/bibliotheque/document.model';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { tr } from '../../../core/i18n/traduction.service';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocumentCard, EtiquetteDocument } from '../../../shared/ui/document-card/document-card';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { SearchBar } from '../../../shared/ui/search-bar/search-bar';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { SectionHeader } from '../../../shared/ui/section-header/section-header';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { OfflineRepository } from '../../../core/bibliotheque/offline-repository';
import { StockageHorsLigne } from '../../../core/bibliotheque/stockage-hors-ligne';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { FavorisRepository } from '../../../core/bibliotheque/favoris-repository';
import {
  LectureProgress,
  LectureProgressRepository,
} from '../../../core/bibliotheque/lecture-progress-repository';
import {
  DocumentModel,
  DocumentType,
  } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

/** Les trois façons de retrouver un document qu'on a déjà croisé. */
type Onglet = 'telecharges' | 'favoris' | 'historique';

@Component({
  selector: 'nl-offline-library',
  standalone: true,
  imports: [TypeDocumentPipe, 
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
  private readonly stockage = inject(StockageHorsLigne);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly favorisRepo = inject(FavorisRepository);
  private readonly lectures = inject(LectureProgressRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly offlineIds = signal<Set<string>>(new Set());
  protected readonly favoris = signal<DocumentModel[]>([]);
  protected readonly progression = signal<Map<string, LectureProgress>>(new Map());
  /** Place occupée et place totale, en octets, telles que le navigateur les estime. */
  protected readonly stockageUtilise = signal<number | null>(null);
  protected readonly stockageTotal = signal<number | null>(null);

  protected readonly onglet = signal<Onglet>('telecharges');
  protected readonly recherche = signal('');

  protected readonly offlineDocuments = computed(() => {
    const ids = this.offlineIds();
    return this.documents().filter((d) => ids.has(d.id));
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
    if (!utilise || !total) return 0;
    // Un plancher visible : 0,3 % d'un quota de 10 Go donnerait une jauge
    // vide alors que des documents sont bel et bien là.
    return Math.max(2, Math.min(100, Math.round((utilise / total) * 100)));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    // L'inventaire local d'abord, et sans réseau : c'est la seule chose dont
    // cet écran a réellement besoin pour exister. Le serveur complète ensuite
    // la liste - et son échec n'est plus fatal, là où il laissait « Impossible
    // de charger les documents hors-ligne » sur un écran dont c'est
    // précisément la raison d'être.
    await this.stockage.rafraichir();
    const locaux = this.stockage.ids();
    void this.mesurerStockage();

    try {
      const [ids, docs, favoris, avancement] = await Promise.all([
        this.offlineRepo.getOfflineIds().catch(() => new Set<string>()),
        this.docsRepo.getDocuments(),
        this.favorisRepo.getFavorites().catch(() => [] as DocumentModel[]),
        this.lectures.getAll().catch(() => new Map<string, LectureProgress>()),
      ]);
      this.offlineIds.set(new Set([...locaux, ...ids]));
      this.documents.set(docs);
      this.favoris.set(favoris);
      this.progression.set(avancement);
    } catch {
      // Hors ligne : les fiches rangées avec les fichiers suffisent à dresser
      // la liste. C'est tout l'objet de cet écran.
      const fiches = await this.stockage.fiches();
      this.offlineIds.set(new Set(locaux));
      this.documents.set(
        fiches.map((f) => ({
          ...(f as unknown as DocumentModel),
          // Le JSON a transformé la date en chaîne ; l'écran l'affiche.
          dateAjout: new Date(String((f as Record<string, unknown>)['dateAjout'] ?? Date.now())),
        })),
      );
      if (locaux.size === 0) {
        this.error.set('Impossible de charger les documents hors-ligne.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async mesurerStockage(): Promise<void> {
    const estimation = await this.stockage.estimation();
    this.stockageUtilise.set(estimation?.utilise ?? null);
    this.stockageTotal.set(estimation?.total ?? null);
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

  /**
   * Le cache se gère dans les réglages, où vivent déjà le détail de ce qui
   * est gardé et le bouton qui le vide. Un second endroit pour la même chose,
   * c'est deux endroits à tenir d'accord.
   */
  protected gererCache(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.parametres);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }

  protected async remove(doc: DocumentModel): Promise<void> {
    try {
      await this.stockage.supprimer(doc.id);
      await this.offlineRepo.removeOffline(doc.id);
      const ids = new Set(this.offlineIds());
      ids.delete(doc.id);
      this.offlineIds.set(ids);
      void this.mesurerStockage();
    } catch {
      // Silencieux.
    }
  }





  /** « Prêt hors-ligne » n'est dit que des documents dont le fichier est là. */
  protected etiquettesDe(doc: DocumentModel): EtiquetteDocument[] {
    const etiquettes: EtiquetteDocument[] = [{ texte: doc.matiere }];
    if (this.stockage.ids().has(doc.id)) {
      etiquettes.push({
        texte: tr('pwaPretHorsLigne', 'Prêt hors-ligne'),
        ton: 'cyan',
        icone: 'cloud_done',
      });
    }
    return etiquettes;
  }

  /** Fraction lue, pour la jauge sous la carte. */
  protected avancementDe(doc: DocumentModel): number | undefined {
    const p = this.progression().get(doc.id);
    if (!p || p.totalPages <= 0) return undefined;
    return Math.min(1, p.pageCourante / p.totalPages);
  }

  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }

  /** 482 Mo, 1,4 Go - l'unité qui se lit, pas l'octet brut. */
  protected lisible(octets: number | null): string {
    if (octets == null) return '-';
    const mo = octets / (1024 * 1024);
    if (mo < 1024) return `${Math.round(mo)} Mo`;
    return `${(mo / 1024).toFixed(1).replace('.', ',')} Go`;
  }
}
