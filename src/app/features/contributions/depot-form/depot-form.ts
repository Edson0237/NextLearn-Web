import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DepotRepository } from '../../../core/contributions/depot-repository';
import { ReferencesRepository } from '../../../core/references/references-repository';
import { DepotLicence, LICENCES_PROPOSEES, anneesAcademiquesProposees } from '../../../core/contributions/depot.model';
import { TypeContenuOption, MatiereOption } from '../../../core/references/references.model';
import { niveauCourt } from '../../../core/models/user.model';
import { ToastService } from '../../../shared/ui/toast/toast';
import { Icon } from '../../../shared/ui/icon/icon';
import { Failure } from '../../../core/models/failure.model';
import { AppRoutes } from '../../../core/router/app-routes';

/** 20 Mo — contrôlé ici en plus du serveur : découvrir le refus après
 * avoir téléversé quinze mégaoctets coûte du temps et des données, sur
 * une connexion mobile mesurée. */
const TAILLE_MAX_OCTETS = 20 * 1024 * 1024;

/**
 * Proposer un document — traduction de `DepotFormPage`
 * (`lib/domains/contributions/presentation/pages/depot_form_page.dart`).
 *
 * **Non repris** : le scanner caméra. La source elle-même dégrade
 * silencieusement sur le web (`ScannerService.instance.disponible`
 * vaut déjà faux) — ce n'est pas un renoncement de ce portage, c'est le
 * comportement documenté par la source pour cette même plateforme.
 *
 * **Simplifié** : la liste de matières proposées retombe toujours sur le
 * catalogue général filtré par niveau, jamais sur « le programme de
 * l'étudiant » (`contexteCourantProvider`) — ce domaine (contexte
 * académique) n'existe pas encore côté Angular, et c'est exactement le
 * repli que la source elle-même emploie tant qu'aucune matière n'est
 * rattachée à la filière.
 */
@Component({
  selector: 'app-depot-form',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './depot-form.html',
  styleUrl: './depot-form.scss',
})
export class DepotForm {
  protected readonly DepotLicence = DepotLicence;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly repo = inject(DepotRepository);
  private readonly refs = inject(ReferencesRepository);
  private readonly toast = inject(ToastService);

  protected readonly licences = LICENCES_PROPOSEES;
  protected readonly annees = anneesAcademiquesProposees(new Date());

  protected readonly titre = signal('');
  protected readonly description = signal('');
  protected readonly auteur = signal('');
  protected readonly sourceDeclaree = signal('');
  protected readonly type = signal<string | undefined>(undefined);
  protected readonly matiereId = signal<string | undefined>(undefined);
  protected readonly anneeAcademique = signal(this.annees[0]);
  protected readonly licence = signal<DepotLicence | undefined>(undefined);
  protected readonly fichier = signal<File | undefined>(undefined);

  protected readonly types = signal<Cascade<TypeContenuOption>>({ statut: 'chargement', items: [] });
  protected readonly matieres = signal<Cascade<MatiereOption>>({ statut: 'chargement', items: [] });

  protected readonly envoiEnCours = signal(false);

  constructor() {
    void this.chargerTypes();
    void this.chargerMatieres();
  }

  private async chargerTypes(): Promise<void> {
    try {
      this.types.set({ statut: 'pret', items: await this.repo.getTypes() });
    } catch {
      this.types.set({ statut: 'erreur', items: [] });
    }
  }

  private async chargerMatieres(): Promise<void> {
    const niveau = this.auth.state().user?.niveau;
    try {
      const items = await this.refs.getMatieres({ niveau: niveau ? niveauCourt(niveau) : undefined });
      this.matieres.set({ statut: 'pret', items });
    } catch {
      this.matieres.set({ statut: 'erreur', items: [] });
    }
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected surFichierChoisi(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (f.size > TAILLE_MAX_OCTETS) {
      this.toast.erreur('Ce fichier dépasse 20 Mo. Choisis-en un plus léger.');
      return;
    }
    this.fichier.set(f);
  }

  protected retirerFichier(): void {
    this.fichier.set(undefined);
  }

  protected async envoyer(): Promise<void> {
    const titre = this.titre().trim();
    const description = this.description().trim();

    if (titre.length < 3) return this.toast.info("Donne un titre d'au moins 3 caractères.");
    if (description.length < 10) return this.toast.info('Décris le document en 10 caractères au moins.');
    if (!this.type()) return this.toast.info('Choisis le type de document.');
    if (!this.matiereId()) return this.toast.info('Choisis la matière.');
    if (!this.licence()) return this.toast.info("Indique d'où vient ce document.");
    const fichier = this.fichier();
    if (!fichier) return this.toast.info('Joins le fichier PDF.');

    this.envoiEnCours.set(true);
    try {
      await this.repo.deposer({
        titre, description,
        type: this.type()!,
        matiereId: this.matiereId()!,
        anneeAcademique: this.anneeAcademique(),
        licence: this.licence()!,
        sourceDeclaree: this.sourceDeclaree().trim() || undefined,
        auteur: this.auteur().trim() || undefined,
        fichier,
      });
      this.toast.succes('Document envoyé. Tu seras prévenu après la relecture.');
      void this.router.navigate(['/app', AppRoutes.mesDepots]);
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible. Réessaie.');
    } finally {
      this.envoiEnCours.set(false);
    }
  }

  protected annuler(): void {
    void this.router.navigate(['/app', AppRoutes.mesDepots]);
  }
}

interface Cascade<T> {
  readonly statut: 'chargement' | 'pret' | 'erreur';
  readonly items: readonly T[];
}
