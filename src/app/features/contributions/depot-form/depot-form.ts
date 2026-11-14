import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { DepotRepository } from '../../../core/contributions';
import { ReferencesRepository } from '../../../core/references';
import { DepotLicence, LICENCES_PROPOSEES, anneesAcademiquesProposees } from '../../../core/contributions';
import { TypeContenuOption, MatiereOption, OptionReference } from '../../../core/references';
import { niveauCourt } from '../../../core/models';
import { ToastService } from '../../../shared/ui/toast/toast';
import { Icon } from '../../../shared/ui/icon/icon';
import { Failure } from '../../../core/models';
import { ScanTransfert } from '../../../core/scan';
import { AppRoutes } from '../../../core/router';

/**
 * Le plafond de taille avant d'avoir la réponse du serveur : celui que
 * l'administration règle aujourd'hui. Le plafond réel est demandé au serveur ;
 * le contrôler ici en plus évite de découvrir le refus après avoir téléversé
 * des dizaines de mégaoctets, sur une connexion mobile mesurée.
 */
const TAILLE_MAX_PAR_DEFAUT_MO = 50;

/**
 * Proposer un document - traduction de `DepotFormPage`
 * (`lib/domains/contributions/presentation/pages/depot_form_page.dart`).
 *
 * **Non repris** : le scanner caméra. La source elle-même dégrade
 * silencieusement sur le web (`ScannerService.instance.disponible`
 * vaut déjà faux) - ce n'est pas un renoncement de ce portage, c'est le
 * comportement documenté par la source pour cette même plateforme.
 *
 * **Simplifié** : la liste de matières proposées retombe toujours sur le
 * catalogue général filtré par niveau, jamais sur « le programme de
 * l'étudiant » (`contexteCourantProvider`) - ce domaine (contexte
 * académique) n'existe pas encore côté Angular, et c'est exactement le
 * repli que la source elle-même emploie tant qu'aucune matière n'est
 * rattachée à la filière.
 */
@Component({
  selector: 'app-depot-form',
  standalone: true,
  imports: [TraductionPipe, Icon],
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
  protected readonly sousTypesEpreuve = signal<OptionReference[]>([]);
  protected readonly sousTypeEpreuve = signal<string | undefined>(undefined);
  protected readonly estEpreuve = computed(() => this.type()?.toUpperCase() === 'EPREUVE');
  protected readonly matiereId = signal<string | undefined>(undefined);
  protected readonly anneeAcademique = signal(this.annees[0]);
  protected readonly licence = signal<DepotLicence | undefined>(undefined);
  protected readonly fichier = signal<File | undefined>(undefined);

  protected readonly types = signal<Cascade<TypeContenuOption>>({ statut: 'chargement', items: [] });
  protected readonly matieres = signal<Cascade<MatiereOption>>({ statut: 'chargement', items: [] });

  protected readonly envoiEnCours = signal(false);

  /** Le plafond de taille réglé par l'administration (Mo). */
  private readonly scans = inject(ScanTransfert);
  protected readonly tailleMaxMo = signal(TAILLE_MAX_PAR_DEFAUT_MO);

  constructor() {
    // Un document qui vient d'être scanné arrive ici comme s'il avait été importé.
    const scanne = this.scans.reprendre();
    if (scanne) this.fichier.set(scanne);
    void this.refs.getLimitesFichier().then((l) => this.tailleMaxMo.set(l.maxFileSizeMb)).catch(() => undefined);
    void this.refs.getTypesEpreuve().then((items) => this.sousTypesEpreuve.set(items)).catch(() => undefined);
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
      const brut = await this.refs.getMatieres({ niveau: niveau ? niveauCourt(niveau) : undefined });
      const motifHorsMatiere = /^(SN|TD|TP|CC|DS|ISJ|RATTRAPAGE|SESSION|EXAMEN|EPREUVE|SUJET|CORRIG[EÉ]|CORRECTION|M[EÉ]DIAN)\b/i;
      const vus = new Set<string>();
      const items = brut.filter((m) => {
        const nom = (m.nom ?? '').trim();
        if (!nom || motifHorsMatiere.test(nom)) return false;
        const cle = nom.toLowerCase();
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
      });
      this.matieres.set({ statut: 'pret', items });
    } catch {
      this.matieres.set({ statut: 'erreur', items: [] });
    }
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected surChangementType(type: string | undefined): void {
    this.type.set(type);
    if (type?.toUpperCase() !== 'EPREUVE') {
      this.sousTypeEpreuve.set(undefined);
    } else if (!this.sousTypeEpreuve() && this.sousTypesEpreuve().length > 0) {
      this.sousTypeEpreuve.set(this.sousTypesEpreuve()[0].value);
    }
  }

  protected surFichierChoisi(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    // Le PDF seulement : c'est le seul format que l'application sait lire.
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      this.toast.erreur(tr('depotFormatPdfSeulement', 'Seuls les fichiers PDF sont acceptés pour le moment.'));
      return;
    }
    if (f.size > this.tailleMaxMo() * 1024 * 1024) {
      this.toast.erreur(tr('depotFichierDepasseMax', `Ce fichier dépasse ${this.tailleMaxMo()} Mo. Choisis-en un plus léger.`, { max: this.tailleMaxMo() }));
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

    if (titre.length < 3) return this.toast.info(tr('depotTitreTropCourt', "Donne un titre d'au moins 3 caractères."));
    if (description.length < 10) return this.toast.info(tr('depotDescriptionTropCourte', 'Décris le document en 10 caractères au moins.'));
    if (!this.type()) return this.toast.info(tr('depotChoisisType', 'Choisis le type de document.'));
    if (!this.matiereId()) return this.toast.info(tr('depotChoisisMatiere', 'Choisis la matière.'));
    if (!this.licence()) return this.toast.info("Indique d'où vient ce document.");
    const fichier = this.fichier();
    if (!fichier) return this.toast.info(tr('depotJoinsFichier', 'Joins le fichier PDF.'));

    this.envoiEnCours.set(true);
    try {
      await this.repo.deposer({
        titre, description,
        type: this.type()!,
        typeEpreuve: this.estEpreuve() ? this.sousTypeEpreuve() : undefined,
        matiereId: this.matiereId()!,
        anneeAcademique: this.anneeAcademique(),
        licence: this.licence()!,
        sourceDeclaree: this.sourceDeclaree().trim() || undefined,
        auteur: this.auteur().trim() || undefined,
        fichier,
      });
      this.toast.succes(tr('depotEnvoye', 'Document envoyé. Tu seras prévenu après la relecture.'));
      void this.router.navigate(['/app', AppRoutes.mesDepots]);
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible. Réessaie.');
    } finally {
      this.envoiEnCours.set(false);
    }
  }

  protected scanner(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.depotScanner);
  }

  protected annuler(): void {
    void this.router.navigate(['/app', AppRoutes.mesDepots]);
  }
}

interface Cascade<T> {
  readonly statut: 'chargement' | 'pret' | 'erreur';
  readonly items: readonly T[];
}
