import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { ContexteService } from '../../../core/contexte';
import { DocumentModel, DocumentType } from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router/app-routes';

/** La teinte des dossiers : suit le thème, comme le reste de l'interface. */
const PALETTE = ['var(--primary)'];

/** La mémoire du mode d'affichage ; un stockage indisponible ne doit rien casser. */
const CLE_MODE = 'nl_catalogue_mode';
const CatalogueMode = {
  lire(): 'grille' | 'liste' {
    try { return localStorage.getItem(CLE_MODE) === 'liste' ? 'liste' : 'grille'; } catch { return 'grille'; }
  },
  ecrire(mode: 'grille' | 'liste'): void {
    try { localStorage.setItem(CLE_MODE, mode); } catch { /* sans stockage, le choix vaut pour la visite */ }
  },
};

@Component({
  selector: 'nl-catalogue',
  standalone: true,
  imports: [TraductionPipe, CommonModule, Icon, EmptyState, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogue.html',
  styleUrl: './catalogue.scss',
})
export class Catalogue implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);

  /** Dossiers en grille de deux colonnes, ou en liste ; le choix est gardé d'une visite à l'autre. */
  protected readonly mode = signal<'grille' | 'liste'>(CatalogueMode.lire());

  protected choisirMode(mode: 'grille' | 'liste'): void {
    this.mode.set(mode);
    CatalogueMode.ecrire(mode);
  }

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly propres = signal<{ id: string; nom: string; couleur: string; count: number }[]>([]);
  protected readonly communes = signal<{ id: string; nom: string; couleur: string; count: number }[]>([]);

  /**
   * Le programme de l'étudiant est-il rattaché à des matières ?
   *
   * Sinon, « Ma filière » mentirait : les matières affichées viennent des
   * documents eux-mêmes, pas du programme. La version mobile le dit - « Matières
   * disponibles », avec une phrase d'explication - et la PWA affichait la même
   * étiquette dans les deux cas.
   */
  protected readonly programmeConnu = computed(() => this.contexte.matieres().length > 0);

  protected readonly nombreMatieres = computed(() => this.propres().length + this.communes().length);
  protected readonly nombreDocuments = computed(() =>
    [...this.propres(), ...this.communes()].reduce((somme, m) => somme + m.count, 0),
  );

  /** Le plus fourni : les barres des cartes se mesurent à lui. */
  private readonly plusFourni = computed(() =>
    Math.max(1, ...[...this.propres(), ...this.communes()].map((m) => m.count)),
  );

  protected partDe(count: number): string {
    // Un plancher visible : une matière à un document sur un pic de trente
    // ferait sinon un trait d'un pixel, indistinct d'une matière vide.
    return count <= 0 ? '0%' : `${Math.max(6, Math.round((count / this.plusFourni()) * 100))}%`;
  }

  /**
   * La teinte de la carte : la couleur que le serveur donne à la matière, ou
   * celle de l'application à défaut. Son adaptation au thème se fait en CSS
   * (`catalogue.scss`), là où l'on connaît la couleur du texte.
   */
  protected teinte(_couleur: string, rang = 0): string {
    // Le bleu de l'application pour tous les dossiers : la couleur que
    // l'administration donne à une matière ne sert pas ici - vingt dossiers de
    // vingt couleurs ne se lisent pas mieux que vingt dossiers bleus.
    return PALETTE[rang % PALETTE.length];
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.docsRepo.getDocuments();
      this.documents.set(docs);
      this.groupMatieres(docs);
    } catch (e) {
      this.error.set('Impossible de charger le catalogue.');
    } finally {
      this.loading.set(false);
    }
  }

  private groupMatieres(docs: DocumentModel[]): void {
    const contexteMatieres = this.contexte.matieres();
    const parId = new Map<string, { id: string; nom: string; couleur: string; count: number; troncCommun: boolean }>();

    if (contexteMatieres.length > 0) {
      for (const m of contexteMatieres) {
        parId.set(m.id, { id: m.id, nom: m.nom, couleur: m.couleur, count: 0, troncCommun: m.troncCommun });
      }
    }

    for (const d of docs) {
      if (!d.matiereId) continue;
      if (parId.has(d.matiereId)) {
        const existing = parId.get(d.matiereId)!;
        existing.count++;
      } else {
        parId.set(d.matiereId, { id: d.matiereId, nom: d.matiere, couleur: '', count: 1, troncCommun: false });
      }
    }

    const all = [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
    this.propres.set(all.filter((m) => !m.troncCommun));
    this.communes.set(all.filter((m) => m.troncCommun));
  }

  protected openMatiere(id: string): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.matierePath(id));
  }

  protected retour(): void {
    void this.router.navigate(['/app', AppRoutes.bibliotheque]);
  }

  protected openBibliotheque(): void {
    void this.router.navigate(['/app', AppRoutes.bibliotheque]);
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
}
