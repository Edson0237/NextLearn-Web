import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EpreuvesRepository } from '../../../core/epreuves/epreuves-repository';
import { EpreuveModel, TypeEpreuve, typeEpreuveVersApi } from '../../../core/epreuves/epreuve.model';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';
import { Refreshable } from '../../../shared/ui/refreshable/refreshable';
import { Icon } from '../../../shared/ui/icon/icon';
import { Failure } from '../../../core/models/failure.model';
import { AppRoutes } from '../../../core/router/app-routes';

interface Filtre {
  readonly matiereId?: string;
  readonly annee?: number;
  readonly avecCorrige?: boolean;
  readonly type?: TypeEpreuve;
}

const FILTRE_VIDE: Filtre = {};

/**
 * Liste des épreuves (onglet du shell) — traduction d'`EpreuvesListPage`
 * (`lib/domains/epreuves/presentation/pages/epreuves_list/epreuves_list_page.dart`).
 * Filtrage entièrement client, sur la liste complète déjà chargée — comme
 * dans la source, qui en dérive les filtres plutôt que de les redemander
 * au serveur.
 */
@Component({
  selector: 'app-epreuves-list',
  standalone: true,
  imports: [EmptyState, DocumentSkeleton, Refreshable, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epreuves-list.html',
  styleUrl: './epreuves-list.scss',
})
export class EpreuvesList {
  private readonly router = inject(Router);
  private readonly repo = inject(EpreuvesRepository);

  protected readonly TypeEpreuve = TypeEpreuve;

  protected readonly toutes = signal<EpreuveModel[]>([]);
  protected readonly statut = signal<'chargement' | 'pret' | 'erreur'>('chargement');
  protected readonly erreur = signal('');
  protected readonly rafraichissement = signal(false);

  protected readonly filtre = signal<Filtre>(FILTRE_VIDE);

  protected readonly filtrees = computed(() => {
    const f = this.filtre();
    let liste = this.toutes();
    if (f.matiereId) liste = liste.filter((e) => e.matiereId === f.matiereId);
    if (f.annee != null) liste = liste.filter((e) => e.annee === f.annee);
    if (f.avecCorrige) liste = liste.filter((e) => e.avecCorrige);
    // Égalité stricte : un sujet de nature inconnue n'est ni CC ni SN et
    // reste sous « Tous » — le faire apparaître sous les deux rendrait le
    // découpage inutile.
    if (f.type) liste = liste.filter((e) => e.typeEpreuve === f.type);
    return [...liste].sort((a, b) => b.annee - a.annee);
  });

  protected readonly matieres = computed(() => {
    const parId = new Map<string, string>();
    for (const e of this.toutes()) if (e.matiereId) parId.set(e.matiereId, e.matiere);
    return [...parId.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  });

  protected readonly annees = computed(() => {
    const valeurs = new Set(this.toutes().map((e) => e.annee));
    return [...valeurs].sort((a, b) => b - a);
  });

  protected readonly filtreActif = computed(() => {
    const f = this.filtre();
    return f.matiereId != null || f.annee != null || f.avecCorrige != null || f.type != null;
  });

  constructor() {
    void this.charger();
  }

  private async charger(): Promise<void> {
    this.statut.set('chargement');
    try {
      this.toutes.set(await this.repo.getEpreuves());
      this.statut.set('pret');
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Réessaie plus tard.');
      this.statut.set('erreur');
    }
  }

  protected async rafraichir(): Promise<void> {
    this.rafraichissement.set(true);
    await this.charger();
    this.rafraichissement.set(false);
  }

  protected typeApi(t: TypeEpreuve): string {
    return typeEpreuveVersApi(t);
  }

  protected setType(t: TypeEpreuve | undefined): void {
    this.filtre.set({ ...this.filtre(), type: t });
  }

  protected setMatiere(id: string | undefined): void {
    const courant = this.filtre();
    this.filtre.set({ ...courant, matiereId: courant.matiereId === id ? undefined : id });
  }

  protected setAnnee(a: number | undefined): void {
    this.filtre.set({ ...this.filtre(), annee: a });
  }

  /** Angular n'autorise pas les assertions de type (`as`) dans un gabarit. */
  protected anneeSaisie(e: Event): number | undefined {
    const valeur = (e.target as HTMLSelectElement).value;
    return valeur ? Number(valeur) : undefined;
  }

  protected toggleCorrige(): void {
    const courant = this.filtre();
    this.filtre.set({ ...courant, avecCorrige: courant.avecCorrige ? undefined : true });
  }

  protected reinitialiser(): void {
    this.filtre.set(FILTRE_VIDE);
  }

  protected ouvrir(id: string): void {
    void this.router.navigate(['/app', AppRoutes.epreuveDetailPath(id)]);
  }
}
