import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { tr, TraductionPipe, TraductionService } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { DepotRepository } from '../../../core/contributions';
import { ReferencesRepository, traduireOptionReference } from '../../../core/references';
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
export interface DoublonFichierInfo {
  readonly message: string;
  readonly conseil?: string;
  readonly existant?: {
    readonly type: 'epreuve' | 'document' | 'contribution';
    readonly id: string;
    readonly titre?: string;
    readonly statut?: string;
  };
}

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
  private readonly traductions = inject(TraductionService);

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
  protected readonly typesAffiches = computed(() => {
    this.traductions.langue();
    this.traductions.aDesMessages();
    const t = this.types();
    return {
      statut: t.statut,
      items: t.items.map((x) => ({ ...x, label: traduireOptionReference(x.value, x.label) })),
    };
  });
  protected readonly sousTypesAffiches = computed(() => {
    this.traductions.langue();
    this.traductions.aDesMessages();
    return this.sousTypesEpreuve().map((x) => ({
      ...x,
      label: traduireOptionReference(x.value, x.label),
    }));
  });
  protected readonly matieres = signal<Cascade<MatiereOption>>({ statut: 'chargement', items: [] });

  protected readonly envoiEnCours = signal(false);
  /** Détails d'un doublon de fichier (Chantier P8 : 409 `DUPLICATE_FILE`). */
  protected readonly doublonDetecte = signal<DoublonFichierInfo | null>(null);
  protected readonly pourquoiOuvert = signal(false);
  /** Erreurs de validation par champ (`details.fields`, Chantier P12 — §18.2). */
  protected readonly erreursChamps = signal<Readonly<Record<string, string>>>({});
  protected readonly champsNonRattaches = computed(() => {
    const connues = new Set([
      'titre',
      'description',
      'type',
      'typeEpreuve',
      'auteur',
      'matiereId',
      'matiere',
      'anneeAcademique',
      'annee',
      'licence',
      'sourceDeclaree',
      'file',
      'fichier',
    ]);
    return Object.entries(this.erreursChamps())
      .filter(([champ, msg]) => !connues.has(champ) && Boolean(msg))
      .map(([champ, message]) => ({ champ, message }));
  });
  /** Erreur d'envoi (P12 & P13 : `FILE_TOO_LARGE`, `UPLOAD_INVALID`, `5xx` avec `requestId`). */
  protected readonly erreurDepot = signal<{ readonly message: string; readonly requestId?: string } | null>(null);
  protected readonly detailsErreurOuverts = signal(false);
  protected readonly requestIdCopie = signal(false);

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
    this.doublonDetecte.set(null);
    this.pourquoiOuvert.set(false);
  }

  protected retirerFichier(): void {
    this.fichier.set(undefined);
    this.doublonDetecte.set(null);
    this.pourquoiOuvert.set(false);
  }

  protected basculerPourquoi(): void {
    this.pourquoiOuvert.update((v) => !v);
  }

  protected voirDocumentExistant(id: string): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(id));
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
    this.doublonDetecte.set(null);
    this.pourquoiOuvert.set(false);
    this.erreursChamps.set({});
    this.erreurDepot.set(null);
    this.detailsErreurOuverts.set(false);
    this.requestIdCopie.set(false);
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
      if (e instanceof Failure) {
        if (e.fields) {
          this.erreursChamps.set(e.fields);
        }
        if (e.statusCode === 409 && e.details?.['code'] === 'DUPLICATE_FILE') {
          const rawExistant = e.details['existant'] as Record<string, unknown> | undefined;
          const typeExistant = rawExistant?.['type'];
          const idExistant = rawExistant?.['id'] ? String(rawExistant['id']) : '';
          const existant: DoublonFichierInfo['existant'] =
            (typeExistant === 'epreuve' || typeExistant === 'document' || typeExistant === 'contribution') && idExistant
              ? {
                  type: typeExistant,
                  id: idExistant,
                  titre: rawExistant?.['titre'] ? String(rawExistant['titre']) : undefined,
                  statut: rawExistant?.['statut'] ? String(rawExistant['statut']) : undefined,
                }
              : undefined;
          const conseil = typeof e.details['conseil'] === 'string' ? e.details['conseil'] : undefined;
          this.doublonDetecte.set({
            message: e.message,
            conseil,
            existant,
          });
        } else {
          const messageAffiche =
            e.code === 'FILE_TOO_LARGE'
              ? `${e.message} (max ${this.tailleMaxMo()} Mo)`
              : e.message;
          this.erreurDepot.set({
            message: messageAffiche,
            requestId: e.requestId,
          });
        }
      }
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible. Réessaie.');
    } finally {
      this.envoiEnCours.set(false);
    }
  }

  protected async copierRequestId(): Promise<void> {
    const reqId = this.erreurDepot()?.requestId;
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

  protected async contacterSupport(): Promise<void> {
    await this.copierRequestId();
    void this.router.navigateByUrl('/app/' + AppRoutes.supportTickets);
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
