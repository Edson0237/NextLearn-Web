import { metaDocument, noteDocument } from '../../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentCard, EtiquetteDocument } from '../../../shared/ui/document-card/document-card';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { SearchBar } from '../../../shared/ui/search-bar/search-bar';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { libelleNiveau } from '../../../core/models';
import { computed } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { FormatsService } from '../../../core/references/formats.service';
import { ContexteService } from '../../../core/contexte';
import { AuthService } from '../../../core/auth';
import {
  DocumentModel,
  DocumentType,
  } from '../../../core/bibliotheque';
import { BottomSheetService } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { FiltresSheet, FiltresSheetData, FiltresSheetResultat } from '../filtres-sheet/filtres-sheet';
import { AppRoutes } from '../../../core/router/app-routes';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

/** En deçà, la saisie ne filtre pas encore (et ne compte donc pas comme filtre). */
const SEUIL_TEXTE = 2;

@Component({
  selector: 'nl-bibliotheque-home',
  standalone: true,
  imports: [TypeDocumentPipe, 
    CascadeEnter, TraductionPipe, CommonModule, FormsModule, DocumentCard, Icon,
    EmptyState, Button, AppHeader, SearchBar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bibliotheque-home.html',
  styleUrl: './bibliotheque-home.scss',
})
export class BibliothequeHome implements OnInit {
  private readonly router = inject(Router);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);
  private readonly auth = inject(AuthService);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly sheets = inject(BottomSheetService);

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly cursus = computed(() => {
    const u = this.user();
    if (!u) return undefined;
    return [u.universite, libelleNiveau(u.niveau, u.cycle)].filter(Boolean).join(' • ');
  });

  /** Combien de filtres sont posés - la pastille du bouton « Filtres ». */
  protected readonly nombreFiltres = computed(
    () =>
      (this.selectedType() ? 1 : 0) +
      (this.selectedMatiere() ? 1 : 0) +
      (this.texteRecherche().length >= SEUIL_TEXTE ? 1 : 0),
  );

  /** Le texte saisi, nettoyé - le même que celui qui filtre la liste. */
  private readonly texteRecherche = computed(() => this.searchQuery().toLowerCase().trim());

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly selectedType = signal<DocumentType | null>(null);
  protected readonly selectedMatiere = signal<string | null>(null);
  protected readonly searchActive = signal(false);
  protected readonly searchQuery = signal('');

  /**
   * Les types proposés en filtre.
   *
   * Quatre y figuraient quand le catalogue en compte neuf : un corrigé, une
   * annale ou un TP n'étaient atteignables par aucune puce, alors qu'ils
   * existent côté serveur et que l'accueil y mène désormais directement.
   */
  private readonly tabsDeRepli = [
    { type: null, label: tr('epreuveTypeTous', 'Tous') },
    { type: DocumentType.cours, label: tr('biblioFiltreCours', 'Cours') },
    { type: DocumentType.td, label: 'TD' },
    { type: DocumentType.tp, label: 'TP' },
    { type: DocumentType.synthese, label: 'Synthèse' },
    { type: DocumentType.epreuve, label: tr('epreuveTitre', 'Épreuve') },
    { type: DocumentType.annales, label: tr('titreAnnales', 'Annales') },
    { type: DocumentType.corrige, label: tr('epreuvesCorrige', 'Corrigé') },
    { type: DocumentType.rapport, label: 'Rapport' },
    { type: DocumentType.expose, label: 'Exposé' },
  ] as const;

  private readonly formats = inject(FormatsService);

  /**
   * Les puces de format : celles que le serveur propose, dans son ordre et sous
   * ses libellés. La liste ci-dessus ne sert que tant qu'il n'a pas répondu.
   */
  protected readonly tabs = computed(() => {
    const serveur = this.formats.formats();
    const tous = this.tabsDeRepli[0];
    if (!serveur) return this.tabsDeRepli;
    return [tous, ...serveur.map((f) => ({ type: f.type, label: f.label }))];
  });

  protected readonly filteredDocuments = signal<DocumentModel[]>([]);

  constructor() {
    // Le type demandé par l'accueil (« Accès rapide ») arrive en paramètre
    // d'URL : il survit ainsi au rechargement et se partage, là où l'état de
    // navigation d'Angular disparaît au premier F5.
    const demande = inject(ActivatedRoute).snapshot.queryParamMap.get('type');
    if (demande) {
      const connu = Object.values(DocumentType).find((t) => t === demande);
      if (connu) this.selectedType.set(connu as DocumentType);
    }

    effect(() => {
      this.filteredDocuments.set(
        this.documents().filter((d) =>
          this.correspond(d, this.selectedType(), this.selectedMatiere(), true),
        ),
      );
    });
  }

  /** Un document passe-t-il ces filtres ? Le texte saisi s'applique toujours si `avecTexte`. */
  private correspond(
    d: DocumentModel,
    type: DocumentType | null,
    matiereId: string | null,
    avecTexte: boolean,
  ): boolean {
    if (type && d.type !== type) return false;
    if (matiereId && d.matiereId !== matiereId) return false;
    const q = this.texteRecherche();
    if (avecTexte && q.length >= SEUIL_TEXTE) {
      return d.titre.toLowerCase().includes(q) || d.matiere.toLowerCase().includes(q);
    }
    return true;
  }

  async ngOnInit(): Promise<void> {
    // L'inventaire local dit quelles cartes porteront la marque « hors
    // ligne » : il se lit sans réseau, donc avant la liste.
    await this.stockage.rafraichir();
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.docsRepo.getDocuments();
      this.documents.set(docs);
    } catch (e) {
      this.error.set('Impossible de charger les documents.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectType(type: DocumentType | null): void {
    this.selectedType.set(type);
  }

  protected selectMatiere(id: string | null): void {
    this.selectedMatiere.set(id);
  }

  protected openSearch(): void {
    void this.router.navigate(['/app', AppRoutes.recherche]);
  }

  /** Ouvre le panneau de filtres ; le brouillon n'est appliqué qu'à la validation. */
  protected async ouvrirFiltres(): Promise<void> {
    const handle = this.sheets.open<FiltresSheet, FiltresSheetResultat>(FiltresSheet, {
      formats: this.tabs(),
      matieres: this.matiereOptions(),
      type: this.selectedType(),
      matiere: this.selectedMatiere(),
      compter: (type, matiere) => this.nombreCorrespondants(type, matiere),
    } satisfies FiltresSheetData);
    const choix = await handle.result;
    if (!choix) return;
    if (choix === 'catalogue') {
      this.openCatalogue();
      return;
    }
    this.selectedType.set(choix.type);
    this.selectedMatiere.set(choix.matiere);
  }

  private nombreCorrespondants(type: DocumentType | null, matiere: string | null): number {
    return this.documents().filter((d) => this.correspond(d, type, matiere, true)).length;
  }

  protected openCatalogue(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.matieres);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/app', AppRoutes.favoris]);
  }

  protected openOffline(): void {
    void this.router.navigate(['/app', AppRoutes.offlineLibrary]);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }

  protected matiereOptions(): { id: string; nom: string }[] {
    const map = new Map<string, string>();
    for (const d of this.documents()) {
      if (d.matiereId) map.set(d.matiereId, d.matiere);
    }
    return [...map.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  }



  /**
   * Combien de documents donnerait ce format, compte tenu de la matière et du
   * texte déjà posés - jamais plus que ce que la liste affichera vraiment.
   */
  protected compteType(type: DocumentType | null): number {
    return this.nombreCorrespondants(type, this.selectedMatiere());
  }

  /** Idem pour une matière, le format choisi étant appliqué. */
  protected compteMatiere(id: string | null): number {
    return this.nombreCorrespondants(this.selectedType(), id);
  }

  protected etiquettesDe(doc: DocumentModel): EtiquetteDocument[] {
    const etiquettes: EtiquetteDocument[] = [{ texte: doc.matiere, ton: 'primaire' }];
    const parcours = [doc.niveau, doc.semestre].filter(Boolean).join(' • ');
    if (parcours) etiquettes.push({ texte: parcours });
    if (doc.avecCorrige) {
      etiquettes.push({ texte: tr('epreuvesCorrige', 'Corrigé'), ton: 'emeraude', icone: 'task_alt' });
    }
    return etiquettes;
  }

  protected estHorsLigne(doc: DocumentModel): boolean {
    return this.stockage.ids().has(doc.id);
  }

  protected async telecharger(doc: DocumentModel): Promise<void> {
    const url = (await this.docsRepo.urlLecture(doc.id).catch(() => null)) ?? doc.urlPdf;
    if (!url) return;
    void this.docsRepo.recordDownload(doc.id);
    const lien = window.document.createElement('a');
    lien.href = url;
    lien.download = `${doc.titre}.pdf`;
    lien.rel = 'noopener';
    lien.target = '_blank';
    lien.click();
  }

  protected reinitialiser(): void {
    this.selectedType.set(null);
    this.selectedMatiere.set(null);
    this.searchQuery.set('');
  }

  protected openProfil(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  protected openNotifications(): void {
    void this.router.navigate(['/app', AppRoutes.notifications]);
  }



  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }
}
