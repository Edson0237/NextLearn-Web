import { Fraicheur } from '../../shared/services/fraicheur';
import { TelechargementEtat } from '../../shared/services/telechargement-etat';
import { metaDocument, noteDocument } from '../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, effect, untracked, computed, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { DocumentsRepository } from '../../core/bibliotheque';
import { ProfilRepository } from '../../core/profil';
import { FormatsService } from '../../core/references';
import { ContexteRepository } from '../../core/contexte';
import { CONTEXTE_OUVERT, MatiereDuProgramme, typeVisible, fonctionnaliteFermee } from '../../core/contexte';
import {
  LectureProgress,
  LectureProgressRepository,
  pourcentageLu,
  StockageHorsLigne,
} from '../../core/bibliotheque';
import {
  DocumentModel,
  DocumentType,
  } from '../../core/bibliotheque';
import { libelleNiveau } from '../../core/models';
import { DocumentCard, EtiquetteDocument } from '../../shared/ui/document-card/document-card';
import { AppHeader } from '../../shared/ui/app-header/app-header';
import { SearchBar } from '../../shared/ui/search-bar/search-bar';
import { SectionHeader } from '../../shared/ui/section-header/section-header';
import { Badge } from '../../shared/ui/badge/badge';
import { tr } from '../../core/i18n';
import { FeuilleSelectionService } from '../../shared/ui/bottom-sheet/feuille-selection';
import { Icon } from '../../shared/ui/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Button } from '../../shared/ui/button/button';
import { AnimatedNumber } from '../../shared/ui/animated-number/animated-number';
import { AppRoutes } from '../../core/router';
import { presentationType, TypeDocumentPipe } from '../../shared/ui/type-document/presentation-type-document';

/** Une lecture en cours, avec le document qu'elle désigne. */
interface Reprise {
  readonly document: DocumentModel;
  readonly progression: LectureProgress;
  readonly pourcentage: number;
}

@Component({
  selector: 'nl-home',
  standalone: true,
  imports: [TypeDocumentPipe, 
    TraductionPipe, CommonModule, DocumentCard, Icon, EmptyState, Button, AnimatedNumber,
    AppHeader, SearchBar, SectionHeader, Badge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly fraicheur = inject(Fraicheur);
  private premierTick = true;

  protected readonly telechargements = inject(TelechargementEtat);
  private readonly router = inject(Router);
  private readonly selections = inject(FeuilleSelectionService);
  private readonly auth = inject(AuthService);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly profilRepo = inject(ProfilRepository);
  private readonly contexteRepo = inject(ContexteRepository);
  private readonly lectureRepo = inject(LectureProgressRepository);
  private readonly stockage = inject(StockageHorsLigne);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly recommended = signal<DocumentModel[]>([]);
  protected readonly popular = signal<DocumentModel[]>([]);
  protected readonly recent = signal<DocumentModel[]>([]);

  protected readonly streak = signal(0);
  /** Documents disponibles hors ligne et documents lus - les vrais chiffres.
   *  Ils étaient écrits en dur à zéro dans le gabarit. */
  protected readonly horsLigne = signal(0);
  protected readonly lus = signal(0);


  private readonly formats = inject(FormatsService);
  protected readonly contexte = signal(CONTEXTE_OUVERT);
  /** La recherche, quand l'administration ne l'a pas fermée. */
  protected readonly rechercheOuverte = computed(() => !fonctionnaliteFermee(this.contexte(), 'search'));
  protected readonly reprises = signal<Reprise[]>([]);

  /**
   * Les matières du programme, tronc commun mis à part.
   *
   * La distinction n'est pas décorative : une matière de tronc commun est
   * partagée avec les autres filières du même niveau, ses documents viennent
   * d'ailleurs. Les mêler effacerait la séparation que l'administration a
   * posée.
   */
  protected readonly matieresFiliere = computed(() =>
    this.contexte().matieres.filter((m) => !m.troncCommun),
  );
  protected readonly matieresTroncCommun = computed(() =>
    this.contexte().matieres.filter((m) => m.troncCommun),
  );

  /**
   * Les types de document ouverts à cet étudiant.
   *
   * Chercher « toutes les épreuves de ma filière » n'est pas une recherche :
   * il n'y a pas de mot à taper, c'est un filtre - donc un bouton.
   */
  private readonly tousLesTypes = [
    DocumentType.epreuve,
    DocumentType.annales,
    DocumentType.td,
    DocumentType.cours,
    DocumentType.synthese,
    DocumentType.corrige,
    DocumentType.tp,
    DocumentType.expose,
  ];

  /** Les types ouverts à cet étudiant, dans l'ordre d'usage. */
  private readonly typesDisponibles = computed(() => {
    const nommes = this.tousLesTypes.filter((t) => this.formats.actif(t) && typeVisible(this.contexte(), t));
    // Les formats créés dans l'administration viennent après ceux qu'on nomme.
    const supplementaires = (this.formats.formats() ?? [])
      .map((f) => f.type)
      .filter((t) => !this.tousLesTypes.includes(t) && t !== DocumentType.autre);
    return [...nommes, ...supplementaires];
  });

  /**
   * Les trois formats qu'on vient chercher, et rien d'autre.
   *
   * Les huit tuiles d'avant couvraient deux écrans à elles seules et
   * mettaient « Exposé » au même rang qu'« Épreuve ». Épreuves, annales et
   * TD sont ce pour quoi on ouvre l'application la veille d'un examen ; le
   * reste passe derrière une quatrième tuile.
   */
  protected readonly typesRapides = computed(() => this.typesDisponibles().slice(0, 3));

  /** Ceux qui vivent derrière la tuile « Plus de formats ». */
  protected readonly typesSecondaires = computed(() => this.typesDisponibles().slice(3));

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly subtitle = computed(() => {
    const u = this.user();
    if (!u) return 'Bienvenue sur NextLearn';
    return [libelleNiveau(u.niveau, u.cycle), u.filiere].filter(Boolean).join(' · ');
  });

  /**
   * Les formats secondaires, en feuille.
   *
   * Une feuille plutôt que cinq tuiles de plus : la liste est consultée
   * rarement, et chaque entrée y garde son icône et sa teinte, donc se
   * reconnaît aussi vite qu'une tuile.
   */
  protected async ouvrirAutresFormats(): Promise<void> {
    const choisi = await this.selections.ouvrir<DocumentType>({
      title: tr('homeChoisirFormat', 'Choisir un format'),
      choices: this.typesSecondaires().map((t) => {
        const p = presentationType(t);
        return { value: t, label: p.label, icone: p.icone, teinte: p.couleur, teinteFond: p.fond };
      }),
      emptyMessage: tr('selecteurAucunResultat', 'Aucun résultat'),
    });
    if (choisi) this.openBibliotheque(choisi);
  }

  constructor() {
    // Relecture silencieuse quand l'application revient, que la connexion revient, ou toutes les cinq minutes.
    effect(() => {
      this.fraicheur.tick();
      untracked(() => {
        if (this.premierTick) { this.premierTick = false; return; }
        void this.load(true);
      });
    });
  }

  async ngOnInit(): Promise<void> {
    void this.telechargements.initialiser();
    await this.load();
  }

  async load(silencieux = false): Promise<void> {
    if (!silencieux) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const [rec, pop, recents, stats, contexte, progression] = await Promise.all([
        this.docsRepo.getRecommended(),
        this.docsRepo.getPopular(),
        this.docsRepo.getRecent(),
        this.profilRepo.getStats().catch(() => null),
        this.contexteRepo.charger(),
        this.lectureRepo.getAll().catch(() => new Map<string, LectureProgress>()),
      ]);

      this.recommended.set(rec);
      this.popular.set(pop);
      this.recent.set(recents);
      this.streak.set(stats?.streak ?? 0);
      this.horsLigne.set(Math.max(stats?.docsTelecharges ?? 0, this.stockage.ids().size));
      this.lus.set(stats?.docsLus ?? 0);
      this.contexte.set(contexte);
      this.reprises.set(
        this.composerReprises(progression, [...this.stockage.fiches(), ...rec, ...pop, ...recents]),
      );
    } catch {
      const fichesLocales = this.stockage.fiches();
      if (fichesLocales.length > 0) {
        const progressionLocale = await this.lectureRepo
          .getAll()
          .catch(() => new Map<string, LectureProgress>());
        this.horsLigne.set(this.stockage.ids().size);
        this.reprises.set(this.composerReprises(progressionLocale, fichesLocales));
        this.recommended.set([...fichesLocales]);
        return;
      }
      if (silencieux) return; // une erreur passagère ne remplace pas ce qui est affiché
      this.error.set("Impossible de charger l'accueil.");
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Les lectures commencées et non finies, les plus récentes d'abord.
   *
   * Seuls les documents déjà connus des trois rangées sont proposés : aller
   * chercher une fiche par identifiant pour chaque progression ferait autant
   * de requêtes que de lectures en cours, au chargement de l'accueil.
   */
  private composerReprises(
    progression: Map<string, LectureProgress>,
    documents: readonly DocumentModel[],
  ): Reprise[] {
    const parId = new Map(documents.map((d) => [d.id, d]));
    const reprises: Reprise[] = [];
    for (const p of progression.values()) {
      const document = parId.get(p.documentId);
      if (!document) continue;
      const pourcentage = pourcentageLu(p);
      if (pourcentage <= 0 || pourcentage >= 1) continue;
      reprises.push({ document, progression: p, pourcentage });
    }
    return reprises
      .sort((a, b) => (a.progression.derniereLecture < b.progression.derniereLecture ? 1 : -1))
      .slice(0, 5);
  }

  /** L'école et le niveau, tels qu'affichés dans l'en-tête. */
  protected readonly cursus = computed(() => {
    const u = this.user();
    if (!u) return undefined;
    return [u.universite, libelleNiveau(u.niveau, u.cycle)].filter(Boolean).join(' • ');
  });

  protected openProfil(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  /**
   * Télécharge depuis la carte, sans passer par la fiche.
   *
   * C'est le geste qu'on répète - et l'obliger à passer par un écran de plus
   * était le reproche principal fait à l'ancienne liste.
   */
  protected telecharger(doc: DocumentModel): Promise<void> {
    return this.telechargements.telecharger(doc);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }

  protected reprendre(reprise: Reprise): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docReaderPath(reprise.document.id));
  }

  protected openMatiere(matiere: MatiereDuProgramme): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.matierePath(matiere.id));
  }

  protected openBibliotheque(type?: DocumentType): void {
    // Un paramètre d'URL et non l'état de navigation : le filtre survit ainsi
    // à un rechargement et se partage, là où `state` disparaît au premier F5.
    void this.router.navigate(['/app', AppRoutes.bibliotheque], {
      queryParams: type ? { type } : {},
    });
  }

  protected openSearch(): void {
    void this.router.navigate(['/app', AppRoutes.recherche]);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/app', AppRoutes.favoris]);
  }

  protected openOffline(): void {
    void this.router.navigate(['/app', AppRoutes.offlineLibrary]);
  }

  protected openDepot(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.depotForm);
  }

  protected openNotifications(): void {
    void this.router.navigate(['/app', AppRoutes.notifications]);
  }



  /**
   * Les étiquettes d'une carte : la matière, puis le niveau et le semestre
   * s'ils sont connus. Trois au plus - au-delà, la rangée passe à la ligne et
   * la carte perd l'alignement qu'elle partage avec ses voisines.
   */
  protected etiquettesDe(doc: DocumentModel): EtiquetteDocument[] {
    const etiquettes: EtiquetteDocument[] = [
      { texte: doc.matiere, ton: 'primaire' },
    ];
    const parcours = [doc.niveau, doc.semestre].filter(Boolean).join(' • ');
    if (parcours) etiquettes.push({ texte: parcours });
    return etiquettes;
  }



  protected couleurMatiere(matiere: MatiereDuProgramme): string {
    return matiere.couleur;
  }

  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }
}
