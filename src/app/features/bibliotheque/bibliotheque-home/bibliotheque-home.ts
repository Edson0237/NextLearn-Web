import { Fraicheur } from '../../../shared/services/fraicheur';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { metaDocument, noteDocument } from '../../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { tr, TraductionPipe, TraductionService } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentCard, EtiquetteDocument } from '../../../shared/ui/document-card/document-card';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { SearchBar } from '../../../shared/ui/search-bar/search-bar';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { libelleNiveau, SectionAcademique, SectionPreference } from '../../../core/models';
import { computed } from '@angular/core';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { FormatsService } from '../../../core/references';
import { ContexteService } from '../../../core/contexte';
import { AuthService } from '../../../core/auth';
import {
  DocumentModel,
  DocumentType,
  } from '../../../core/bibliotheque';
import { BottomSheetService } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { FiltresSheet, FiltresSheetData, FiltresSheetResultat } from '../filtres-sheet/filtres-sheet';
import { AppRoutes } from '../../../core/router';
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
  private readonly fraicheur = inject(Fraicheur);
  private premierTick = true;

  protected readonly telechargements = inject(TelechargementEtat);
  private readonly router = inject(Router);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);
  private readonly auth = inject(AuthService);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly sheets = inject(BottomSheetService);

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly nombreHorsLigne = computed(() => this.stockage.ids().size);
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
      (this.selectedSection() ? 1 : 0) +
      (this.texteRecherche().length >= SEUIL_TEXTE ? 1 : 0),
  );

  /** Le texte saisi, nettoyé - le même que celui qui filtre la liste. */
  private readonly texteRecherche = computed(() => this.searchQuery().toLowerCase().trim());

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly selectedType = signal<DocumentType | null>(null);
  protected readonly selectedMatiere = signal<string | null>(null);
  private readonly traductions = inject(TraductionService);
  protected readonly selectedSection = signal<SectionAcademique | null>(null);
  protected readonly sectionsFiltre = computed<{ value: SectionAcademique | null; label: string }[]>(() => {
    this.traductions.langue();
    return [
      { value: null, label: this.traductions.t('sectionToutes', undefined, 'Toutes sections') },
      { value: 'FRANCOPHONE', label: this.traductions.t('sectionFrancophone', undefined, 'Francophone') },
      { value: 'ANGLOPHONE', label: this.traductions.t('sectionAnglophone', undefined, 'Anglophone') },
    ];
  });
  private dernierePrefSection: SectionPreference | null | undefined = undefined;
  private dernierParcours: string | undefined = undefined;
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
    this.traductions.langue();
    this.traductions.aDesMessages();
    const tous = { type: null, label: this.traductions.t('epreuveTypeTous', undefined, 'Tous') };
    const serveur = this.formats.formats();
    if (serveur) {
      return [tous, ...serveur.map((f) => ({ type: f.type, label: f.label }))];
    }
    return [
      tous,
      { type: DocumentType.cours, label: this.traductions.t('biblioFiltreCours', undefined, 'Cours') },
      { type: DocumentType.td, label: 'TD' },
      { type: DocumentType.tp, label: 'TP' },
      { type: DocumentType.synthese, label: this.traductions.t('epreuvesSynthese', undefined, 'Synthèse') },
      { type: DocumentType.epreuve, label: this.traductions.t('epreuveTitre', undefined, 'Épreuve') },
      { type: DocumentType.annales, label: this.traductions.t('titreAnnales', undefined, 'Annales') },
      { type: DocumentType.corrige, label: this.traductions.t('epreuvesCorrige', undefined, 'Corrigé') },
      { type: DocumentType.rapport, label: this.traductions.t('depotTypeRapport', undefined, 'Rapport') },
      { type: DocumentType.expose, label: this.traductions.t('depotTypeExpose', undefined, 'Exposé') },
    ];
  });

  private static readonly PAS_AFFICHAGE = 30;
  protected readonly pageCourante = signal<number>(1);
  protected readonly totalServeur = signal<number | null>(null);
  protected readonly totalTousServeur = signal<number | null>(null);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMoreServer = signal<boolean>(false);
  protected readonly filteredDocuments = signal<DocumentModel[]>([]);
  protected readonly limiteAffichee = signal<number>(BibliothequeHome.PAS_AFFICHAGE);
  protected readonly visibleDocuments = computed(() =>
    this.filteredDocuments().slice(0, this.limiteAffichee()),
  );
  protected readonly totalAffiche = computed(() => {
    const locaux = this.filteredDocuments().length;
    if (this.texteRecherche().length >= SEUIL_TEXTE) return locaux;
    return Math.max(this.totalServeur() ?? 0, locaux);
  });
  protected readonly aPlusDeDocuments = computed(
    () => this.hasMoreServer() || this.filteredDocuments().length > this.limiteAffichee(),
  );

  constructor() {
    // Relecture silencieuse quand l'application revient, que la connexion revient, ou toutes les cinq minutes.
    effect(() => {
      this.fraicheur.tick();
      untracked(() => {
        if (this.premierTick) { this.premierTick = false; return; }
        void this.load(true);
      });
    });

    // Le type demandé par l'accueil (« Accès rapide ») arrive en paramètre
    // d'URL : il survit ainsi au rechargement et se partage, là où l'état de
    // navigation d'Angular disparaît au premier F5.
    const demande = inject(ActivatedRoute).snapshot.queryParamMap.get('type');
    if (demande) {
      const connu = Object.values(DocumentType).find((t) => t === demande);
      if (connu) this.selectedType.set(connu as DocumentType);
    }

    effect(() => {
      const pref = this.user()?.sectionPreference ?? null;
      untracked(() => {
        if (this.dernierePrefSection === pref) return;
        const etaitInitialise = this.dernierePrefSection !== undefined;
        this.dernierePrefSection = pref;
        const sec: SectionAcademique | null =
          pref === 'FRANCOPHONE' || pref === 'ANGLOPHONE' ? pref : null;
        this.selectedSection.set(sec);
        if (etaitInitialise) {
          this.totalTousServeur.set(null);
          void this.load(true);
        }
      });
    });

    effect(() => {
      const u = this.user();
      const parcours = u ? `${u.universite}|${u.filiere}|${u.niveau}` : '';
      untracked(() => {
        if (this.dernierParcours === parcours) return;
        const etaitInitialise = this.dernierParcours !== undefined;
        this.dernierParcours = parcours;
        if (etaitInitialise) {
          this.totalTousServeur.set(null);
          this.totalServeur.set(null);
          void this.load(true);
        }
      });
    });

    effect(() => {
      const type = this.selectedType();
      const matiere = this.selectedMatiere();
      const section = this.selectedSection();
      this.texteRecherche();
      this.filteredDocuments.set(
        this.documents().filter((d) =>
          this.correspond(d, type, matiere, true, section),
        ),
      );
      untracked(() => this.limiteAffichee.set(this.documents().length || BibliothequeHome.PAS_AFFICHAGE));
    });
  }

  protected async afficherPlus(): Promise<void> {
    const cursor = this.nextCursor();
    if (this.hasMoreServer()) {
      try {
        const type = this.selectedType();
        const matiere = this.selectedMatiere();
        const section = this.selectedSection();
        const page = cursor
          ? await this.docsRepo.getDocuments(
              { type: type || undefined, matiereId: matiere || undefined, section: section || undefined },
              cursor,
              20,
            )
          : await this.docsRepo.getDocumentsPage({
              page: this.pageCourante() + 1,
              limit: 20,
              type: type || undefined,
              matiereId: matiere || undefined,
              section: section || undefined,
            });
        this.documents.update((docs) => {
          const connus = new Set(docs.map((d) => d.id));
          return [...docs, ...page.items.filter((d) => !connus.has(d.id))];
        });
        this.pageCourante.set(page.page);
        if (page.total > 0) {
          this.totalServeur.set(page.total);
          if (!type && !matiere) {
            this.totalTousServeur.set(page.total);
          }
        }
        this.nextCursor.set(page.nextCursor ?? null);
        this.hasMoreServer.set(Boolean(page.hasMore));
        this.limiteAffichee.set(this.documents().length);
      } catch {
        this.limiteAffichee.update((n) => n + BibliothequeHome.PAS_AFFICHAGE);
      }
    } else {
      this.limiteAffichee.update((n) => n + BibliothequeHome.PAS_AFFICHAGE);
    }
  }

  /** Un document passe-t-il ces filtres ? Le texte saisi s'applique toujours si `avecTexte`. */
  private correspond(
    d: DocumentModel,
    type: DocumentType | null,
    matiereId: string | null,
    avecTexte: boolean,
    section: SectionAcademique | null = this.selectedSection(),
  ): boolean {
    if (type && d.type !== type) return false;
    if (matiereId && d.matiereId !== matiereId) return false;
    if (section && d.section && d.section !== section) return false;
    const q = this.texteRecherche();
    if (avecTexte && q.length >= SEUIL_TEXTE) {
      return d.titre.toLowerCase().includes(q) || d.matiere.toLowerCase().includes(q);
    }
    return true;
  }

  async ngOnInit(): Promise<void> {
    void this.telechargements.initialiser();
    // L'inventaire local dit quelles cartes porteront la marque « hors
    // ligne » : il se lit sans réseau, donc avant la liste.
    await this.stockage.rafraichir();
    await this.load();
  }

  async load(silencieux = false): Promise<void> {
    if (!silencieux) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const type = this.selectedType();
      const matiere = this.selectedMatiere();
      const section = this.selectedSection();
      const page = await this.docsRepo.getDocuments(
        { type: type || undefined, matiereId: matiere || undefined, section: section || undefined },
        undefined,
        20,
      );
      this.documents.set([...page.items]);
      this.pageCourante.set(page.page);
      this.totalServeur.set(page.total);
      if (!type && !matiere) {
        this.totalTousServeur.set(page.total);
      } else if (this.totalTousServeur() === null) {
        void this.chargerTotalTous(section);
      }
      this.nextCursor.set(page.nextCursor ?? null);
      this.hasMoreServer.set(Boolean(page.hasMore));
    } catch {
      const fichesLocales = this.stockage.fiches();
      if (fichesLocales.length > 0) {
        this.documents.set([...fichesLocales]);
        this.totalServeur.set(null);
        this.totalTousServeur.set(null);
        return;
      }
      if (silencieux) return; // une erreur passagère ne remplace pas ce qui est affiché
      this.error.set('Impossible de charger les documents.');
    } finally {
      this.loading.set(false);
    }
  }

  private async chargerTotalTous(section: SectionAcademique | null): Promise<void> {
    try {
      const page = await this.docsRepo.getDocuments(
        { section: section || undefined },
        undefined,
        1,
      );
      if (this.selectedSection() === section) {
        this.totalTousServeur.set(page.total);
      }
    } catch {
      // Silencieux : le repli reste le décompte local.
    }
  }

  protected selectType(type: DocumentType | null): void {
    if (this.selectedType() === type) return;
    this.selectedType.set(type);
    void this.load();
  }

  protected selectMatiere(id: string | null): void {
    if (this.selectedMatiere() === id) return;
    this.selectedMatiere.set(id);
    void this.load();
  }

  protected selectSection(section: SectionAcademique | null): void {
    if (this.selectedSection() === section) return;
    this.selectedSection.set(section);
    this.totalTousServeur.set(null);
    void this.load();
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
      section: this.selectedSection(),
      compter: (type, matiere, section) => this.nombreCorrespondants(type, matiere, section),
    } satisfies FiltresSheetData);
    const choix = await handle.result;
    if (!choix) return;
    if (choix === 'catalogue') {
      this.openCatalogue();
      return;
    }
    const sectionChangee = choix.section !== this.selectedSection();
    const filtreServeurChange =
      choix.type !== this.selectedType() ||
      choix.matiere !== this.selectedMatiere() ||
      sectionChangee;
    this.selectedType.set(choix.type);
    this.selectedMatiere.set(choix.matiere);
    this.selectedSection.set(choix.section);
    if (sectionChangee) {
      this.totalTousServeur.set(null);
    }
    if (filtreServeurChange) {
      void this.load();
    }
  }

  private nombreCorrespondants(
    type: DocumentType | null,
    matiere: string | null,
    section: SectionAcademique | null = this.selectedSection(),
  ): number {
    const localCount = this.documents().filter((d) =>
      this.correspond(d, type, matiere, true, section),
    ).length;
    if (this.texteRecherche().length < SEUIL_TEXTE && section === this.selectedSection()) {
      if (type === null && matiere === null && this.totalTousServeur() !== null) {
        return Math.max(this.totalTousServeur()!, localCount);
      }
      if (
        type === this.selectedType() &&
        matiere === this.selectedMatiere() &&
        this.totalServeur() !== null
      ) {
        return Math.max(this.totalServeur()!, localCount);
      }
    }
    return localCount;
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
    if (doc.section) {
      etiquettes.push({ texte: doc.section === 'FRANCOPHONE' ? 'FR' : 'EN' });
    }
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

  protected telecharger(doc: DocumentModel): Promise<void> {
    return this.telechargements.telecharger(doc);
  }

  protected reinitialiser(): void {
    const doitRecharger = this.selectedType() !== null || this.selectedMatiere() !== null;
    this.selectedType.set(null);
    this.selectedMatiere.set(null);
    this.searchQuery.set('');
    if (doitRecharger) {
      void this.load();
    }
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
