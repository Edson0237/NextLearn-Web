import { Fraicheur } from '../../../shared/services/fraicheur';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import {
  ClasseBibliothequeService,
  DocumentModel,
  DocumentType,
  DocumentsRepository,
  Facettes,
  ReponseCatalogue,
  RequeteCatalogue,
  StockageHorsLigne,
  TriCatalogue,
  ValeurFacette,
  codeFacetteString,
  metaDocument,
  noteDocument,
  ressourceVersDocumentModel,
  sectionCatalogueDepuisPreference,
} from '../../../core/bibliotheque';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { tr, TraductionPipe, TraductionService } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { DocumentCard, EtiquetteDocument } from '../../../shared/ui/document-card/document-card';
import { AppHeader } from '../../../shared/ui/app-header/app-header';
import { SearchBar } from '../../../shared/ui/search-bar/search-bar';
import { Failure, libelleNiveau, SectionAcademique, SectionPreference } from '../../../core/models';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { FormatsService } from '../../../core/references';
import { ContexteService } from '../../../core/contexte';
import { AuthService } from '../../../core/auth';
import { BottomSheetService } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { FiltresSheet, FiltresSheetData, FiltresSheetResultat } from '../filtres-sheet/filtres-sheet';
import { AppRoutes } from '../../../core/router';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

/** En deçà, la saisie ne filtre pas encore (et ne compte donc pas comme filtre). */
const SEUIL_TEXTE = 2;
const DELAI_RECHERCHE_MS = 300;

export type CleFiltreCatalogue =
  | 'type'
  | 'typeEpreuve'
  | 'semestre'
  | 'matiere'
  | 'enseignant'
  | 'annee'
  | 'section'
  | 'avecCorrige'
  | 'q';

export interface PastilleFiltreActif {
  readonly cle: CleFiltreCatalogue;
  readonly label: string;
}

@Component({
  selector: 'nl-bibliotheque-home',
  standalone: true,
  imports: [
    TypeDocumentPipe,
    CascadeEnter,
    TraductionPipe,
    CommonModule,
    FormsModule,
    DocumentCard,
    Icon,
    EmptyState,
    Button,
    AppHeader,
    SearchBar,
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
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);
  private readonly auth = inject(AuthService);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly classeBiblio = inject(ClasseBibliothequeService);
  private readonly sheets = inject(BottomSheetService);
  private readonly traductions = inject(TraductionService);
  private readonly formats = inject(FormatsService);

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly nombreHorsLigne = computed(() => this.stockage.ids().size);

  /** Section académique déduite de la préférence persistante du compte (§3.8). */
  protected readonly sectionProfil = computed<SectionAcademique | null>(() =>
    sectionCatalogueDepuisPreference(this.user()?.sectionPreference),
  );

  /** Vrai lorsque l'étudiant a choisi ponctuellement dans la Bibliothèque une section différente de son Profil (§3.8, §8.4). */
  protected readonly filtreSectionTemporaire = computed<boolean>(
    () => this.selectedSection() !== this.sectionProfil(),
  );

  /**
   * Vrai tant que l'initialisation d'authentification est en cours ou que le modal de première
   * connexion (`SectionPromptModal`) attend que l'étudiant choisisse sa préférence linguistique (§3.8).
   */
  protected readonly enAttenteChoixSection = computed<boolean>(() =>
    Boolean(
      this.auth.state().isInitializing ||
        (this.user() &&
          !this.user()?.sectionPreference &&
          !this.route.snapshot.queryParamMap.has('section')),
    ),
  );

  protected readonly cursus = computed(() => {
    const u = this.user();
    if (!u) return undefined;
    return [u.universite, libelleNiveau(u.niveau, u.cycle)].filter(Boolean).join(' • ');
  });

  protected readonly loading = signal(false);
  protected readonly chargementPageSuivante = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorRequestId = signal<string | null>(null);
  protected readonly detailsErreurOuverts = signal(false);
  protected readonly requestIdCopie = signal(false);
  protected readonly documents = signal<DocumentModel[]>([]);

  private generationRequete = 0;
  private abortController: AbortController | null = null;

  // ── Filtres combinables (Chantier P5 : Catalogue v2 / Explorer) ──────────
  protected readonly selectedType = signal<DocumentType | null>(null);
  protected readonly selectedTypeEpreuve = signal<string | null>(null);
  protected readonly selectedSemestre = signal<string | null>(null);
  protected readonly selectedMatiere = signal<string | null>(null);
  protected readonly selectedEnseignant = signal<string | null>(null);
  protected readonly selectedAnnee = signal<string | null>(null);
  protected readonly selectedSection = signal<SectionAcademique | null>(null);
  protected readonly selectedAvecCorrige = signal<boolean | null>(null);
  protected readonly selectedTri = signal<TriCatalogue>('recent');

  protected readonly searchActive = signal(false);
  protected readonly searchQuery = signal('');
  private rebondRecherche: ReturnType<typeof setTimeout> | null = null;
  private derniereRechercheServeur = '';

  /** Pile d'ordre d'application des filtres pour « Retirer le dernier filtre ». */
  private readonly historiqueFiltres = signal<CleFiltreCatalogue[]>([]);

  /** Facettes renvoyées par `GET /api/v2/catalogue` (avec compteurs `n` du serveur). */
  protected readonly facettesServeur = signal<Facettes | null>(null);

  /** Le texte saisi, nettoyé - le même que celui qui filtre la liste. */
  private readonly texteRecherche = computed(() => this.searchQuery().toLowerCase().trim());

  /** Combien de filtres sont posés - la pastille du bouton « Filtres ». */
  protected readonly nombreFiltres = computed(
    () =>
      (this.selectedType() ? 1 : 0) +
      (this.selectedTypeEpreuve() ? 1 : 0) +
      (this.selectedSemestre() ? 1 : 0) +
      (this.selectedMatiere() ? 1 : 0) +
      (this.selectedEnseignant() ? 1 : 0) +
      (this.selectedAnnee() ? 1 : 0) +
      (this.filtreSectionTemporaire() ? 1 : 0) +
      (this.selectedAvecCorrige() !== null ? 1 : 0) +
      (this.texteRecherche().length >= SEUIL_TEXTE ? 1 : 0),
  );

  protected readonly sectionsFiltre = computed<{ value: SectionAcademique | null; label: string }[]>(() => {
    this.traductions.langue();
    return [
      { value: null, label: this.traductions.t('sectionToutes', undefined, 'Toutes sections') },
      { value: 'FRANCOPHONE', label: this.traductions.t('sectionFrancophone', undefined, 'Francophone') },
      { value: 'ANGLOPHONE', label: this.traductions.t('sectionAnglophone', undefined, 'Anglophone') },
    ];
  });

  protected readonly trisDisponibles = computed<{ value: TriCatalogue; label: string }[]>(() => {
    this.traductions.langue();
    return [
      { value: 'recent', label: this.traductions.t('biblioTriRecent', undefined, 'Récents') },
      { value: 'annee', label: this.traductions.t('biblioTriAnnee', undefined, 'Année') },
      { value: 'populaire', label: this.traductions.t('biblioTriPopulaire', undefined, 'Populaires') },
      { value: 'alpha', label: this.traductions.t('biblioTriAlpha', undefined, 'A-Z') },
    ];
  });

  /** Puces de nature d'épreuve (SN / CC / Rattrapage / Non précisé) issues des facettes du serveur. */
  protected readonly naturesEpreuve = computed<{ value: string; label: string; n: number }[]>(() => {
    const lang = this.traductions.langue();
    const fac = this.facettesServeur()?.typeEpreuve ?? [];
    return fac
      .map((f) => ({
        value: codeFacetteString(f),
        label: lang === 'en' ? (f.labelEn || f.label) : f.label,
        n: f.n,
      }))
      .filter((x): x is { value: string; label: string; n: number } => x.value !== null);
  });

  /** Puces de semestre issues exclusivement de `facettes.semestre` (§7.1). */
  protected readonly semestresDisponibles = computed<{ value: string; label: string; n: number }[]>(() => {
    const lang = this.traductions.langue();
    const fac = this.facettesServeur()?.semestre ?? [];
    return fac
      .map((f) => ({
        value: codeFacetteString(f),
        label: lang === 'en' ? (f.labelEn || f.label) : f.label,
        n: f.n,
      }))
      .filter((x): x is { value: string; label: string; n: number } => x.value !== null);
  });

  /** Pastilles des filtres actifs, chacune retirable d'un toucher. */
  protected readonly pastillesActives = computed<PastilleFiltreActif[]>(() => {
    const lang = this.traductions.langue();
    const pastilles: PastilleFiltreActif[] = [];
    const type = this.selectedType();
    if (type) {
      const tab = this.tabs().find((t) => t.type === type);
      pastilles.push({ cle: 'type', label: tab?.label ?? String(type) });
    }
    const nature = this.selectedTypeEpreuve();
    if (nature) {
      const nObj = this.naturesEpreuve().find((n) => n.value === nature);
      pastilles.push({ cle: 'typeEpreuve', label: nObj?.label ?? nature });
    }
    const sem = this.selectedSemestre();
    if (sem) {
      const sObj = this.semestresDisponibles().find((s) => s.value === sem);
      pastilles.push({ cle: 'semestre', label: sObj?.label ?? sem });
    }
    const mat = this.selectedMatiere();
    if (mat) {
      const mNom =
        this.matiereOptions().find((m) => m.id === mat)?.nom ??
        this.matieresConnues().get(mat) ??
        'Matière';
      pastilles.push({ cle: 'matiere', label: mNom });
    }
    const ens = this.selectedEnseignant();
    if (ens) {
      const eFac = (this.facettesServeur()?.enseignant ?? []).find((f) => codeFacetteString(f) === ens);
      const eNom = eFac
        ? lang === 'en'
          ? eFac.labelEn || eFac.label
          : eFac.label
        : (this.enseignantsConnus().get(ens) ?? 'Professeur');
      pastilles.push({ cle: 'enseignant', label: eNom });
    }
    const annee = this.selectedAnnee();
    if (annee) {
      const aFac = (this.facettesServeur()?.annee ?? []).find((f) => codeFacetteString(f) === annee);
      const aLabel = aFac ? (lang === 'en' ? aFac.labelEn || aFac.label : aFac.label) : annee;
      pastilles.push({ cle: 'annee', label: aLabel });
    }
    const sec = this.selectedSection();
    if (this.filtreSectionTemporaire()) {
      pastilles.push({
        cle: 'section',
        label:
          sec === 'FRANCOPHONE'
            ? this.traductions.t('sectionFrancophone', undefined, 'Francophone')
            : sec === 'ANGLOPHONE'
              ? this.traductions.t('sectionAnglophone', undefined, 'Anglophone')
              : this.traductions.t('sectionToutes', undefined, 'Toutes sections'),
      });
    }
    const corrige = this.selectedAvecCorrige();
    if (corrige !== null) {
      pastilles.push({
        cle: 'avecCorrige',
        label: corrige
          ? this.traductions.t('epreuvesCorrige', undefined, 'Avec corrigé')
          : 'Sans corrigé',
      });
    }
    const q = this.searchQuery().trim();
    if (q.length >= SEUIL_TEXTE) {
      pastilles.push({ cle: 'q', label: `« ${q} »` });
    }
    return pastilles;
  });

  private dernierePrefSection: SectionPreference | null | undefined = undefined;
  private dernierParcours: string | undefined = undefined;
  private dernierCheminObserve = '';

  /**
   * Les puces de format : celles que le serveur propose et que le contexte
   * étudiant autorise (`contexte.typeVisible`).
   */
  protected readonly tabs = computed(() => {
    this.traductions.langue();
    this.traductions.aDesMessages();
    const tous = { type: null, label: this.traductions.t('epreuveTypeTous', undefined, 'Tous') };
    const serveur = this.formats.formats();
    const base = serveur
      ? serveur.map((f) => ({ type: f.type, label: f.label }))
      : [
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
    const visibles = base.filter(
      (f) => this.contexte.typeVisible(f.type) || this.selectedType() === f.type,
    );
    return [tous, ...visibles];
  });

  private static readonly PAS_AFFICHAGE = 30;
  protected readonly pageCourante = signal<number>(1);
  protected readonly totalServeur = signal<number | null>(null);
  protected readonly totalTousServeur = signal<number | null>(null);
  private readonly matieresConnues = signal<ReadonlyMap<string, string>>(new Map());
  private readonly enseignantsConnus = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly hasMoreServer = signal<boolean>(false);
  protected readonly filteredDocuments = signal<DocumentModel[]>([]);
  protected readonly limiteAffichee = signal<number>(BibliothequeHome.PAS_AFFICHAGE);
  protected readonly visibleDocuments = computed(() =>
    this.filteredDocuments().slice(0, this.limiteAffichee()),
  );
  protected readonly totalAffiche = computed(() => {
    const locaux = this.filteredDocuments().length;
    if (this.totalServeur() !== null) {
      if (this.texteRecherche().length >= SEUIL_TEXTE && this.texteRecherche() !== this.derniereRechercheServeur) {
        return locaux;
      }
      return Math.max(this.totalServeur()!, locaux);
    }
    return locaux;
  });
  protected readonly aPlusDeDocuments = computed(
    () => this.hasMoreServer() || this.filteredDocuments().length > this.limiteAffichee(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.rebondRecherche) clearTimeout(this.rebondRecherche);
      this.abortController?.abort();
    });

    this.dernierCheminObserve = this.cheminSansQuery(this.router.url);
    this.router.events
      .pipe(
        filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((ev) => {
        const precedent = this.dernierCheminObserve;
        const courant = this.cheminSansQuery(ev.urlAfterRedirects || ev.url);
        this.dernierCheminObserve = courant;
        if (!this.estRouteBibliothequeActive(courant)) return;
        if (precedent && precedent !== courant) {
          const qp = this.route.snapshot.queryParamMap;
          const aParamExterne =
            qp.has('type') ||
            qp.has('typeEpreuve') ||
            qp.has('semestre') ||
            qp.has('matiere') ||
            qp.has('matiereId') ||
            qp.has('enseignant') ||
            qp.has('annee') ||
            qp.has('section') ||
            qp.has('avecCorrige') ||
            qp.has('q') ||
            qp.has('tri');
          if (aParamExterne) {
            this.lireFiltresDepuisUrl();
            this.synchroniserUrl();
            void this.load(false, true);
          } else {
            this.synchroniserUrl();
          }
        }
      });

    // Relecture silencieuse quand l'application revient, que la connexion revient, ou toutes les cinq minutes.
    effect(() => {
      this.fraicheur.tick();
      untracked(() => {
        if (this.premierTick) {
          this.premierTick = false;
          return;
        }
        void this.load(true, true);
      });
    });

    const uInit = this.user();
    this.dernierePrefSection = uInit?.sectionPreference ?? null;
    this.dernierParcours = uInit
      ? `${uInit.id}|${uInit.universite}|${uInit.cycle ?? ''}|${uInit.filiere}|${uInit.niveau}`
      : '';
    if (!this.route.snapshot.queryParamMap.has('section')) {
      this.selectedSection.set(sectionCatalogueDepuisPreference(this.dernierePrefSection));
    }

    this.classeBiblio.synchroniserUtilisateur(uInit?.id ?? null);
    this.lireFiltresDepuisUrl();

    // Synchronisation de la préférence linguistique depuis le modal ou depuis Profil (§3.8 & §4.6)
    effect(() => {
      const pref = this.user()?.sectionPreference ?? null;
      untracked(() => {
        if (this.dernierePrefSection === pref) return;
        this.dernierePrefSection = pref;
        this.selectedSection.set(sectionCatalogueDepuisPreference(pref));
        this.depilerFiltre('section');
        this.pageCourante.set(1);
        this.nextCursor.set(null);
        this.hasMoreServer.set(false);
        this.facettesServeur.set(null);
        this.totalTousServeur.set(null);
        this.totalServeur.set(null);
        this.synchroniserUrl();
        void this.load(false, true);
      });
    });

    // Synchronisation du parcours académique (changement de niveau depuis Profil ou changement de compte — §3.9)
    effect(() => {
      const u = this.user();
      const parcours = u
        ? `${u.id}|${u.universite}|${u.cycle ?? ''}|${u.filiere}|${u.niveau}`
        : '';
      untracked(() => {
        this.classeBiblio.synchroniserUtilisateur(u?.id ?? null);
        if (this.dernierParcours === parcours) return;
        this.dernierParcours = parcours;
        this.classeBiblio.invaliderCache();
        this.selectedSection.set(sectionCatalogueDepuisPreference(u?.sectionPreference ?? null));
        this.depilerFiltre('section');
        this.reinitialiserContexteChangementClasse();
        this.synchroniserUrl();
        void this.load(false, true);
      });
    });

    effect(() => {
      const type = this.selectedType();
      const typeEpreuve = this.selectedTypeEpreuve();
      const semestre = this.selectedSemestre();
      const matiere = this.selectedMatiere();
      const enseignant = this.selectedEnseignant();
      const annee = this.selectedAnnee();
      const section = this.selectedSection();
      const avecCorrige = this.selectedAvecCorrige();
      const q = this.texteRecherche();

      this.filteredDocuments.set(
        this.documents().filter((d) =>
          this.correspond(d, type, matiere, true, section, {
            typeEpreuve,
            semestre,
            enseignant,
            annee,
            avecCorrige,
          }),
        ),
      );
      untracked(() => {
        this.limiteAffichee.set(this.documents().length || BibliothequeHome.PAS_AFFICHAGE);
        this.planifierRechercheServeur(q);
      });
    });
  }

  private lireFiltresDepuisUrl(): void {
    const qp = this.route.snapshot.queryParamMap;
    const demandeType = qp.get('type');
    if (demandeType) {
      const norm = demandeType.trim().toLowerCase();
      const connu = Object.values(DocumentType).find((t) => t === norm);
      if (connu) {
        this.selectedType.set(connu as DocumentType);
        this.empilerFiltre('type');
      }
    }
    const typeEpreuve = qp.get('typeEpreuve');
    if (typeEpreuve?.trim()) {
      this.selectedTypeEpreuve.set(typeEpreuve.trim().toUpperCase());
      this.empilerFiltre('typeEpreuve');
    }
    const semestre = qp.get('semestre');
    if (semestre?.trim()) {
      this.selectedSemestre.set(semestre.trim().toUpperCase());
      this.empilerFiltre('semestre');
    }
    const matiere = qp.get('matiere') ?? qp.get('matiereId');
    if (matiere?.trim()) {
      this.selectedMatiere.set(matiere.trim());
      this.empilerFiltre('matiere');
    }
    const enseignant = qp.get('enseignant');
    if (enseignant?.trim()) {
      this.selectedEnseignant.set(enseignant.trim());
      this.empilerFiltre('enseignant');
    }
    const annee = qp.get('annee');
    if (annee?.trim()) {
      this.selectedAnnee.set(annee.trim());
      this.empilerFiltre('annee');
    }
    const section = qp.get('section')?.trim().toUpperCase();
    if (section === 'FRANCOPHONE' || section === 'ANGLOPHONE') {
      this.selectedSection.set(section);
      if (section !== this.sectionProfil()) {
        this.empilerFiltre('section');
      }
    } else if (section === 'TOUTES') {
      this.selectedSection.set(null);
      if (this.sectionProfil() !== null) {
        this.empilerFiltre('section');
      }
    }
    const corrige = qp.get('avecCorrige');
    if (corrige === 'true' || corrige === 'false') {
      this.selectedAvecCorrige.set(corrige === 'true');
      this.empilerFiltre('avecCorrige');
    }
    const q = qp.get('q');
    if (q && q.trim().length >= SEUIL_TEXTE) {
      const propre = q.trim().slice(0, 80);
      this.searchQuery.set(propre);
      this.derniereRechercheServeur = propre.toLowerCase();
      this.empilerFiltre('q');
    }
    const tri = qp.get('tri')?.trim().toLowerCase();
    if (tri === 'recent' || tri === 'annee' || tri === 'populaire' || tri === 'alpha') {
      this.selectedTri.set(tri);
    }
  }

  private cheminSansQuery(url: string): string {
    return (url || '').split('?')[0];
  }

  private estRouteBibliothequeActive(url = this.router.url): boolean {
    const chemin = this.cheminSansQuery(url);
    return (
      !chemin ||
      chemin === '/' ||
      chemin === '/app/' + AppRoutes.bibliotheque ||
      chemin === '/' + AppRoutes.bibliotheque
    );
  }

  private economieDonneesActivee(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      const val = localStorage.getItem('nl_economie_donnees');
      return val === '1' || val === 'true';
    } catch {
      return false;
    }
  }

  private synchroniserUrl(): void {
    if (!this.estRouteBibliothequeActive()) return;
    try {
      const queryParams: Record<string, string | null> = {
        universiteId: null,
        filiereId: null,
        niveau: null,
        type: this.selectedType() ?? null,
        typeEpreuve: this.selectedTypeEpreuve() ?? null,
        semestre: this.selectedSemestre() ?? null,
        matiere: this.selectedMatiere() ?? null,
        enseignant: this.selectedEnseignant() ?? null,
        annee: this.selectedAnnee() ?? null,
        section: this.filtreSectionTemporaire()
          ? (this.selectedSection() ?? (this.sectionProfil() !== null ? 'TOUTES' : null))
          : null,
        avecCorrige:
          this.selectedAvecCorrige() === null ? null : String(this.selectedAvecCorrige()),
        q: this.texteRecherche().length >= SEUIL_TEXTE ? this.searchQuery().trim().slice(0, 80) : null,
        tri: this.selectedTri() !== 'recent' ? this.selectedTri() : null,
      };
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        replaceUrl: true,
      });
    } catch {
      // Environnement de test sans route active
    }
  }

  private planifierRechercheServeur(q: string): void {
    const cible = q.length >= SEUIL_TEXTE ? q.slice(0, 80) : '';
    if (cible === this.derniereRechercheServeur) return;
    if (this.rebondRecherche) clearTimeout(this.rebondRecherche);
    this.rebondRecherche = setTimeout(() => {
      this.derniereRechercheServeur = cible;
      if (cible.length >= SEUIL_TEXTE) {
        this.empilerFiltre('q');
      } else {
        this.depilerFiltre('q');
      }
      this.synchroniserUrl();
      void this.load(true);
    }, DELAI_RECHERCHE_MS);
  }

  private empilerFiltre(cle: CleFiltreCatalogue): void {
    this.historiqueFiltres.update((liste) => [...liste.filter((c) => c !== cle), cle]);
  }

  private depilerFiltre(cle: CleFiltreCatalogue): void {
    this.historiqueFiltres.update((liste) => liste.filter((c) => c !== cle));
  }

  private construireRequeteCatalogue(cursor?: string, page?: number): RequeteCatalogue {
    const q = this.searchQuery().trim();
    const limite = this.economieDonneesActivee() ? 10 : 20;
    return {
      // Le périmètre de classe (école, filière, niveau) est résolu automatiquement côté backend depuis le compte.
      type: this.selectedType() ? this.selectedType()!.toUpperCase() : undefined,
      typeEpreuve: this.selectedTypeEpreuve() ?? undefined,
      semestre: this.selectedSemestre() ?? undefined,
      matiere: this.selectedMatiere() ?? undefined,
      enseignant: this.selectedEnseignant() ?? undefined,
      annee: this.selectedAnnee() ?? undefined,
      section: this.selectedSection() ?? undefined,
      avecCorrige: this.selectedAvecCorrige(),
      q: q.length >= SEUIL_TEXTE ? q.slice(0, 80) : undefined,
      tri: this.selectedTri(),
      cursor: this.selectedTri() === 'recent' ? cursor : undefined,
      page: this.selectedTri() !== 'recent' ? page : undefined,
      limit: limite,
    };
  }

  protected async afficherPlus(): Promise<void> {
    if (this.chargementPageSuivante()) return;
    const cursor = this.nextCursor();
    const limite = this.economieDonneesActivee() ? 10 : 20;
    if (this.hasMoreServer()) {
      this.chargementPageSuivante.set(true);
      const maGeneration = this.generationRequete;
      try {
        const tri = this.selectedTri();
        if (typeof (this.docsRepo as { catalogue?: unknown }).catalogue === 'function' && this.facettesServeur() !== null) {
          const rep = await this.docsRepo.catalogue(
            this.construireRequeteCatalogue(
              tri === 'recent' ? (cursor ?? undefined) : undefined,
              tri !== 'recent' ? this.pageCourante() + 1 : undefined,
            ),
          );
          if (maGeneration !== this.generationRequete) return;
          const nouveaux = rep.ressources.map(ressourceVersDocumentModel);
          this.fusionnerDocuments(nouveaux);
          this.memoriserMatieres(nouveaux);
          this.memoriserEnseignants(rep.facettes);
          this.facettesServeur.set(rep.facettes);
          this.pageCourante.set(rep.pagination.page);
          this.totalServeur.set(rep.total);
          this.nextCursor.set(rep.pagination.nextCursor);
          this.hasMoreServer.set(rep.pagination.hasMore);
          this.limiteAffichee.set(this.documents().length);
          return;
        }

        const type = this.selectedType();
        const matiere = this.selectedMatiere();
        const section = this.selectedSection();
        const page = cursor
          ? await this.docsRepo.getDocuments(
              { type: type || undefined, matiereId: matiere || undefined, section: section || undefined },
              cursor,
              limite,
            )
          : await this.docsRepo.getDocumentsPage({
              page: this.pageCourante() + 1,
              limit: limite,
              type: type || undefined,
              matiereId: matiere || undefined,
              section: section || undefined,
            });
        if (maGeneration !== this.generationRequete) return;
        this.fusionnerDocuments(page.items);
        this.memoriserMatieres(page.items);
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
        if (maGeneration === this.generationRequete) {
          this.limiteAffichee.update((n) => n + BibliothequeHome.PAS_AFFICHAGE);
        }
      } finally {
        if (maGeneration === this.generationRequete) {
          this.chargementPageSuivante.set(false);
        }
      }
    } else {
      this.limiteAffichee.update((n) => n + BibliothequeHome.PAS_AFFICHAGE);
    }
  }

  /** Dédoublonnage strict par `id` lors de la pagination infinie. */
  private fusionnerDocuments(nouveaux: readonly DocumentModel[]): void {
    this.documents.update((docs) => {
      const connus = new Set(docs.map((d) => d.id));
      return [...docs, ...nouveaux.filter((d) => !connus.has(d.id))];
    });
  }

  /** Un document passe-t-il ces filtres ? Le texte saisi s'applique toujours si `avecTexte`. */
  private correspond(
    d: DocumentModel,
    type: DocumentType | null,
    matiereId: string | null,
    avecTexte: boolean,
    section: SectionAcademique | null = this.selectedSection(),
    extra?: {
      typeEpreuve?: string | null;
      semestre?: string | null;
      enseignant?: string | null;
      annee?: string | null;
      avecCorrige?: boolean | null;
    },
  ): boolean {
    if (type && d.type !== type) return false;
    if (matiereId === 'NON_PRECISE') {
      if (d.matiereId) return false;
    } else if (matiereId && d.matiereId !== matiereId) {
      return false;
    }
    if (section && d.section && d.section !== section) return false;
    if (extra?.typeEpreuve === 'NON_PRECISE') {
      if (d.typeEpreuve) return false;
    } else if (
      extra?.typeEpreuve &&
      d.typeEpreuve &&
      d.typeEpreuve.toUpperCase() !== extra.typeEpreuve.toUpperCase()
    ) {
      return false;
    }
    if (extra?.semestre === 'NON_PRECISE') {
      if (d.semestre) return false;
    } else if (
      extra?.semestre &&
      d.semestre &&
      d.semestre.toUpperCase() !== extra.semestre.toUpperCase()
    ) {
      return false;
    }
    if (extra?.enseignant === 'NON_PRECISE') {
      if (d.enseignantId) return false;
    } else if (extra?.enseignant && d.enseignantId && d.enseignantId !== extra.enseignant) {
      return false;
    }
    if (extra?.annee === 'NON_PRECISE') {
      if (d.anneeAcademique) return false;
    } else if (extra?.annee && d.anneeAcademique && d.anneeAcademique !== extra.annee) {
      return false;
    }
    if (typeof extra?.avecCorrige === 'boolean' && d.avecCorrige !== extra.avecCorrige) {
      return false;
    }
    const q = this.texteRecherche();
    if (avecTexte && q.length >= SEUIL_TEXTE && this.facettesServeur() === null) {
      return (
        d.titre.toLowerCase().includes(q) ||
        d.matiere.toLowerCase().includes(q) ||
        d.enseignant.toLowerCase().includes(q)
      );
    }
    return true;
  }

  async ngOnInit(): Promise<void> {
    this.classeBiblio.synchroniserUtilisateur(this.user()?.id ?? null);
    void this.telechargements.initialiser();
    await this.stockage.rafraichir();
    await this.load();
  }

  private appliquerReponseCatalogue(rep: ReponseCatalogue): void {
    const type = this.selectedType();
    const matiere = this.selectedMatiere();
    const items = rep.ressources.map(ressourceVersDocumentModel);
    this.documents.set(this.dedupliquerParId(items));
    this.memoriserMatieres(items);
    this.memoriserMatieresDepuisFacettes(rep.facettes);
    this.memoriserEnseignants(rep.facettes);
    this.facettesServeur.set(rep.facettes);
    this.pageCourante.set(rep.pagination.page);
    this.totalServeur.set(rep.total);
    if (
      !type &&
      !matiere &&
      !this.selectedTypeEpreuve() &&
      !this.selectedSemestre() &&
      !this.selectedEnseignant() &&
      !this.selectedAnnee() &&
      this.selectedAvecCorrige() === null &&
      this.texteRecherche().length < SEUIL_TEXTE
    ) {
      this.totalTousServeur.set(rep.total);
    } else {
      const sommeTypes = (rep.facettes.type ?? []).reduce((s, f) => s + f.n, 0);
      if (!matiere && sommeTypes > 0) {
        this.totalTousServeur.set(sommeTypes);
      }
    }
    this.nextCursor.set(rep.pagination.nextCursor);
    this.hasMoreServer.set(rep.pagination.hasMore);
  }

  async load(silencieux = false, forcerReseau = false): Promise<void> {
    // §3.8 : tant que le modal de première connexion attend le choix de section,
    // ne pas lancer une requête non filtrée qui provoquerait un flash d'une autre section.
    if (this.enAttenteChoixSection()) {
      this.loading.set(true);
      return;
    }

    const maGeneration = ++this.generationRequete;
    this.abortController?.abort();
    const controleur = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.abortController = controleur;
    this.chargementPageSuivante.set(false);

    const userId = this.user()?.id ?? null;
    const mode = 'profil' as const;
    const requeteCatalogue = this.construireRequeteCatalogue(undefined, 1);

    if (!forcerReseau && userId) {
      const enCache = this.classeBiblio.lireCache(userId, mode, requeteCatalogue);
      if (enCache) {
        this.error.set(null);
        this.errorRequestId.set(null);
        this.loading.set(false);
        this.appliquerReponseCatalogue(enCache);
        return;
      }
    }

    if (!silencieux) {
      this.loading.set(true);
      this.error.set(null);
      this.errorRequestId.set(null);
      this.detailsErreurOuverts.set(false);
    }
    try {
      const type = this.selectedType();
      const matiere = this.selectedMatiere();
      const section = this.selectedSection();

      // 1. Catalogue v2 (`GET /api/v2/catalogue`) s'il est disponible
      if (typeof (this.docsRepo as { catalogue?: unknown }).catalogue === 'function') {
        try {
          const rep = await this.docsRepo.catalogue(requeteCatalogue, controleur?.signal);
          if (maGeneration !== this.generationRequete) return;
          if (userId) {
            this.classeBiblio.ecrireCache(userId, mode, requeteCatalogue, rep);
          }
          this.appliquerReponseCatalogue(rep);
          return;
        } catch (errCatalogue) {
          if (errCatalogue instanceof DOMException && errCatalogue.name === 'AbortError') {
            return;
          }
          if (maGeneration !== this.generationRequete) return;
          // Si le serveur renvoie une ValidationError explicite (400), on l'affiche telle quelle
          if (errCatalogue instanceof Failure && errCatalogue.statusCode === 400) {
            throw errCatalogue;
          }
          // Repli transparent sur `getDocuments` (`/api/documents`)
        }
      }

      // 2. Repli `/api/documents`
      const page = await this.docsRepo.getDocuments(
        {
          type: type ? type.toUpperCase() : undefined,
          matiereId: matiere || undefined,
          section: section || undefined,
          semestre: this.selectedSemestre() || undefined,
          anneeAcademique: this.selectedAnnee() || undefined,
          search: this.texteRecherche().length >= SEUIL_TEXTE ? this.searchQuery().trim() : undefined,
        },
        undefined,
        this.economieDonneesActivee() ? 10 : 20,
      );
      if (maGeneration !== this.generationRequete) return;
      this.documents.set(this.dedupliquerParId(page.items));
      this.memoriserMatieres(page.items);
      this.pageCourante.set(page.page);
      this.totalServeur.set(page.total);
      if (!type && !matiere) {
        this.totalTousServeur.set(page.total);
      } else if (this.totalTousServeur() === null) {
        void this.chargerTotalTous(section);
      }
      this.nextCursor.set(page.nextCursor ?? null);
      this.hasMoreServer.set(Boolean(page.hasMore));
    } catch (e) {
      if (maGeneration !== this.generationRequete) return;
      const fichesLocales = this.stockage.fiches();
      if (fichesLocales.length > 0 && !(e instanceof Failure && e.statusCode === 400)) {
        this.documents.set([...fichesLocales]);
        this.totalServeur.set(null);
        this.totalTousServeur.set(null);
        return;
      }
      if (silencieux) return;
      this.error.set(e instanceof Failure ? e.message : 'Impossible de charger les documents.');
      this.errorRequestId.set(e instanceof Failure && e.requestId ? e.requestId : null);
    } finally {
      if (maGeneration === this.generationRequete) {
        this.loading.set(false);
      }
    }
  }

  /** Actualisation manuelle forcée (§9.4) : purge le cache applicatif et recharge. */
  protected actualiserCatalogue(): void {
    this.classeBiblio.invaliderCache();
    void this.load(false, true);
  }

  /** Copie l'identifiant de requête (`requestId`) pour le support (Chantier P12 — §18.2). */
  protected async copierRequestId(): Promise<void> {
    const reqId = this.errorRequestId();
    if (!reqId) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reqId);
      }
      this.requestIdCopie.set(true);
    } catch {
      this.requestIdCopie.set(true);
    }
  }

  /** Copie le `requestId` et ouvre l'écran Support & tickets (§18.2). */
  protected async contacterSupport(): Promise<void> {
    await this.copierRequestId();
    void this.router.navigateByUrl('/app/' + AppRoutes.supportTickets);
  }

  private reinitialiserContexteChangementClasse(): void {
    // Masque les résultats et facettes de la classe précédente pendant le chargement (§5.4 & §6.8)
    this.selectedMatiere.set(null);
    this.selectedEnseignant.set(null);
    this.depilerFiltre('matiere');
    this.depilerFiltre('enseignant');
    this.pageCourante.set(1);
    this.nextCursor.set(null);
    this.hasMoreServer.set(false);
    this.documents.set([]);
    this.filteredDocuments.set([]);
    this.facettesServeur.set(null);
    this.matieresConnues.set(new Map());
    this.enseignantsConnus.set(new Map());
    this.totalServeur.set(null);
    this.totalTousServeur.set(null);
  }

  private dedupliquerParId(items: readonly DocumentModel[]): DocumentModel[] {
    const vus = new Set<string>();
    const sortie: DocumentModel[] = [];
    for (const d of items) {
      if (!vus.has(d.id)) {
        vus.add(d.id);
        sortie.push(d);
      }
    }
    return sortie;
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
    if (type) this.empilerFiltre('type');
    else this.depilerFiltre('type');
    this.synchroniserUrl();
    void this.load();
  }

  protected selectTypeEpreuve(code: string | null): void {
    const suivant = this.selectedTypeEpreuve() === code ? null : code;
    this.selectedTypeEpreuve.set(suivant);
    if (suivant) this.empilerFiltre('typeEpreuve');
    else this.depilerFiltre('typeEpreuve');
    this.synchroniserUrl();
    void this.load();
  }

  protected selectSemestre(code: string | null): void {
    const suivant = this.selectedSemestre() === code ? null : code;
    this.selectedSemestre.set(suivant);
    if (suivant) this.empilerFiltre('semestre');
    else this.depilerFiltre('semestre');
    this.synchroniserUrl();
    void this.load();
  }

  protected selectMatiere(id: string | null): void {
    if (this.selectedMatiere() === id) return;
    this.selectedMatiere.set(id);
    if (id) this.empilerFiltre('matiere');
    else this.depilerFiltre('matiere');
    this.synchroniserUrl();
    void this.load();
  }

  protected selectSection(section: SectionAcademique | null): void {
    if (this.selectedSection() === section) return;
    this.selectedSection.set(section);
    if (section !== this.sectionProfil()) this.empilerFiltre('section');
    else this.depilerFiltre('section');
    this.totalTousServeur.set(null);
    this.synchroniserUrl();
    void this.load();
  }

  /** Restaure le filtre de section sur la préférence enregistrée dans le Profil (§3.8). */
  public revenirASectionProfil(): void {
    const defaut = this.sectionProfil();
    if (this.selectedSection() === defaut) return;
    this.selectedSection.set(defaut);
    this.depilerFiltre('section');
    this.totalTousServeur.set(null);
    this.synchroniserUrl();
    void this.load();
  }

  protected selectTri(tri: TriCatalogue): void {
    if (this.selectedTri() === tri) return;
    this.selectedTri.set(tri);
    this.synchroniserUrl();
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
      facettes: this.facettesServeur(),
      type: this.selectedType(),
      typeEpreuve: this.selectedTypeEpreuve(),
      semestre: this.selectedSemestre(),
      matiere: this.selectedMatiere(),
      enseignant: this.selectedEnseignant(),
      annee: this.selectedAnnee(),
      section: this.selectedSection(),
      avecCorrige: this.selectedAvecCorrige(),
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
      choix.typeEpreuve !== this.selectedTypeEpreuve() ||
      choix.semestre !== this.selectedSemestre() ||
      choix.matiere !== this.selectedMatiere() ||
      choix.enseignant !== this.selectedEnseignant() ||
      choix.annee !== this.selectedAnnee() ||
      choix.avecCorrige !== this.selectedAvecCorrige() ||
      sectionChangee;

    this.appliquerFiltreAvecHistorique('type', choix.type, () => this.selectedType.set(choix.type));
    this.appliquerFiltreAvecHistorique('typeEpreuve', choix.typeEpreuve, () =>
      this.selectedTypeEpreuve.set(choix.typeEpreuve),
    );
    this.appliquerFiltreAvecHistorique('semestre', choix.semestre, () =>
      this.selectedSemestre.set(choix.semestre),
    );
    this.appliquerFiltreAvecHistorique('matiere', choix.matiere, () =>
      this.selectedMatiere.set(choix.matiere),
    );
    this.appliquerFiltreAvecHistorique('enseignant', choix.enseignant, () =>
      this.selectedEnseignant.set(choix.enseignant),
    );
    this.appliquerFiltreAvecHistorique('annee', choix.annee, () =>
      this.selectedAnnee.set(choix.annee),
    );
    this.appliquerFiltreAvecHistorique('section', choix.section, () =>
      this.selectedSection.set(choix.section),
    );
    this.appliquerFiltreAvecHistorique('avecCorrige', choix.avecCorrige, () =>
      this.selectedAvecCorrige.set(choix.avecCorrige),
    );

    if (sectionChangee) {
      this.totalTousServeur.set(null);
    }
    this.synchroniserUrl();
    if (filtreServeurChange) {
      void this.load();
    }
  }

  private appliquerFiltreAvecHistorique(
    cle: CleFiltreCatalogue,
    valeur: unknown,
    appliquer: () => void,
  ): void {
    appliquer();
    if (valeur !== null && valeur !== undefined && valeur !== '') {
      this.empilerFiltre(cle);
    } else {
      this.depilerFiltre(cle);
    }
  }

  protected retirerPastille(cle: CleFiltreCatalogue): void {
    this.depilerFiltre(cle);
    switch (cle) {
      case 'type':
        this.selectedType.set(null);
        break;
      case 'typeEpreuve':
        this.selectedTypeEpreuve.set(null);
        break;
      case 'semestre':
        this.selectedSemestre.set(null);
        break;
      case 'matiere':
        this.selectedMatiere.set(null);
        break;
      case 'enseignant':
        this.selectedEnseignant.set(null);
        break;
      case 'annee':
        this.selectedAnnee.set(null);
        break;
      case 'section':
        this.selectedSection.set(this.sectionProfil());
        this.totalTousServeur.set(null);
        break;
      case 'avecCorrige':
        this.selectedAvecCorrige.set(null);
        break;
      case 'q':
        if (this.rebondRecherche) clearTimeout(this.rebondRecherche);
        this.derniereRechercheServeur = '';
        this.searchQuery.set('');
        break;
    }
    this.synchroniserUrl();
    void this.load();
  }

  /** Retire uniquement le dernier filtre posé (Chantier P5 : état vide). */
  protected retirerDernierFiltre(): void {
    const pile = this.historiqueFiltres();
    if (pile.length > 0) {
      const dernier = pile[pile.length - 1];
      this.retirerPastille(dernier);
      return;
    }
    this.reinitialiser();
  }

  private nombreCorrespondants(
    type: DocumentType | null,
    matiere: string | null,
    section: SectionAcademique | null = this.selectedSection(),
  ): number {
    const fac = this.facettesServeur();
    if (fac && section === this.selectedSection()) {
      if (type !== null && matiere === this.selectedMatiere()) {
        const fType = fac.type.find(
          (x) => typeof x.valeur === 'string' && x.valeur.toLowerCase() === String(type).toLowerCase(),
        );
        if (fType) return fType.n;
      }
      if (matiere !== null && type === this.selectedType()) {
        const fMat = fac.matiere.find((x) => x.valeur === matiere);
        if (fMat) return fMat.n;
      }
    }

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

  private memoriserMatieres(items: readonly DocumentModel[]): void {
    const map = new Map(this.matieresConnues());
    let change = false;
    for (const d of items) {
      if (d.matiereId && d.matiere && !map.has(d.matiereId)) {
        map.set(d.matiereId, d.matiere);
        change = true;
      }
    }
    if (change) this.matieresConnues.set(map);
  }

  private memoriserMatieresDepuisFacettes(facettes: Facettes): void {
    const map = new Map(this.matieresConnues());
    let change = false;
    for (const f of facettes.matiere ?? []) {
      const id = codeFacetteString(f);
      if (id && f.label && !map.has(id)) {
        map.set(id, f.label);
        change = true;
      }
    }
    if (change) this.matieresConnues.set(map);
  }

  private memoriserEnseignants(facettes: Facettes): void {
    const map = new Map(this.enseignantsConnus());
    let change = false;
    for (const f of facettes.enseignant ?? []) {
      const id = codeFacetteString(f);
      if (id && f.label && !map.has(id)) {
        map.set(id, f.label);
        change = true;
      }
    }
    if (change) this.enseignantsConnus.set(map);
  }

  protected matiereOptions(): { id: string; nom: string }[] {
    const lang = this.traductions.langue();
    const fac = this.facettesServeur()?.matiere;
    if (fac && fac.length > 0) {
      return fac
        .map((f) => ({
          id: codeFacetteString(f),
          nom: lang === 'en' ? (f.labelEn || f.label) : f.label,
        }))
        .filter((x): x is { id: string; nom: string } => x.id !== null);
    }
    const map = new Map<string, string>(this.matieresConnues());
    for (const d of this.documents()) {
      if (d.matiereId) map.set(d.matiereId, d.matiere);
    }
    return [...map.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  }

  /**
   * Combien de documents donnerait ce format, compte tenu des facettes du serveur
   * (ou du décompte local en repli hors ligne).
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
    if (doc.typeEpreuve) {
      etiquettes.push({ texte: doc.typeEpreuve });
    }
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
    if (this.rebondRecherche) clearTimeout(this.rebondRecherche);
    this.derniereRechercheServeur = '';
    const sectionParDefaut = this.sectionProfil();
    const sectionChangee = this.selectedSection() !== sectionParDefaut;
    const doitRecharger =
      this.selectedType() !== null ||
      this.selectedTypeEpreuve() !== null ||
      this.selectedSemestre() !== null ||
      this.selectedMatiere() !== null ||
      this.selectedEnseignant() !== null ||
      this.selectedAnnee() !== null ||
      this.selectedAvecCorrige() !== null ||
      this.texteRecherche().length >= SEUIL_TEXTE ||
      sectionChangee;

    this.selectedType.set(null);
    this.selectedTypeEpreuve.set(null);
    this.selectedSemestre.set(null);
    this.selectedMatiere.set(null);
    this.selectedEnseignant.set(null);
    this.selectedAnnee.set(null);
    this.selectedSection.set(sectionParDefaut);
    this.selectedAvecCorrige.set(null);
    this.searchQuery.set('');
    this.historiqueFiltres.set([]);

    if (sectionChangee) {
      this.totalTousServeur.set(null);
    }
    this.synchroniserUrl();
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
