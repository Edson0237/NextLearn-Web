import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TraductionPipe } from '../../../core/i18n';
import { tr } from '../../../core/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { ToastService } from '../../../shared/ui/toast/toast';
import { VerificationRepository } from '../../../core/verification/verification-repository';
import { VerificationService } from '../../../core/verification/verification.service';
import { ReferencesRepository } from '../../../core/references/references-repository';
import { JustificatifType } from '../../../core/references/references.model';
import { AuthService } from '../../../core/auth';
import { libelleNiveau, niveauCourt } from '../../../core/models';
import { VERIFICATION_AUCUNE, VerificationState, VerificationStatut, estApprouve, verificationDepuisJson } from '../../../core/models';
import { AppRoutes } from '../../../core/router/app-routes';

/**
 * Le dépôt du justificatif - pour les comptes dont l'adresse n'est pas celle
 * d'un établissement. Le parcours (école, filière, niveau) a déjà été donné à
 * l'inscription : il est repris tel quel, on ne le redemande pas.
 */
@Component({
  selector: 'nl-verification-form',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verification-form.html',
  styleUrl: './verification-form.scss',
})
export class VerificationForm implements OnInit {
  private readonly router = inject(Router);
  private readonly verificationRepo = inject(VerificationRepository);
  private readonly verification = inject(VerificationService);
  private readonly refs = inject(ReferencesRepository);
  private readonly auth = inject(AuthService);
  private readonly selections = inject(FeuilleSelectionService);
  private readonly actions = inject(FeuilleActionService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly types = signal<JustificatifType[]>([]);
  protected readonly status = signal<VerificationState | null>(null);

  protected readonly nom = signal('');
  protected readonly prenom = signal('');
  protected readonly matricule = signal('');
  protected readonly justificatifType = signal('');
  protected readonly file = signal<File | null>(null);

  /** Le parcours donné à l'inscription, repris du profil. */
  protected readonly user = computed(() => this.auth.state().user);
  protected readonly parcours = computed(() => {
    const u = this.user();
    return u
      ? { universite: u.universite, filiere: u.filiere, niveau: libelleNiveau(u.niveau, u.cycle) }
      : { universite: '', filiere: '', niveau: '' };
  });

  protected readonly typeChoisi = computed(() => this.types().find((t) => t.value === this.justificatifType()));

  /** Dossier déposé, décision pas encore rendue : le formulaire n'a pas lieu d'être. */
  protected dossierEnCours(): boolean {
    const s = this.status()?.statut;
    return s === VerificationStatut.enAttente || s === VerificationStatut.enRevue;
  }

  protected dossierApprouve(): boolean {
    const s = this.status()?.statut;
    return s != null && estApprouve(s);
  }

  /** L'accès à l'application est fermé tant que le justificatif n'est pas approuvé. */
  private bloque(): boolean {
    const s = this.status();
    return !!s && s.requis && !estApprouve(s.statut);
  }

  async ngOnInit(): Promise<void> {
    const user = this.user();
    if (user) {
      this.nom.set(user.nom);
      this.prenom.set(user.prenom);
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [types, status] = await Promise.all([
        this.refs.getJustificatifTypes().catch(() => [] as JustificatifType[]),
        this.verificationRepo.getMyStatus().catch(() => VERIFICATION_AUCUNE),
      ]);
      this.types.set(types);
      this.status.set(status);
    } finally {
      this.loading.set(false);
    }
  }

  protected async choisirType(): Promise<void> {
    const choisi = await this.selections.ouvrir<string>({
      title: tr('pwaTypeJustificatif', 'Type de justificatif'),
      currentValue: this.justificatifType() || undefined,
      choices: this.types().map((t) => ({ value: t.value, label: t.label, description: t.description || undefined })),
      emptyMessage: tr('pwaAucunTypeDisponible', 'Aucun type de justificatif disponible.'),
    });
    if (choisi) this.justificatifType.set(choisi);
  }

  protected onFileChange(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async submit(): Promise<void> {
    const u = this.user();
    if (!u || !this.nom().trim() || !this.prenom().trim()) {
      this.error.set(tr('verifErreurIdentite', 'Renseigne ton nom et ton prénom.'));
      return;
    }
    if (!this.justificatifType()) {
      this.error.set(tr('pwaChoisisTypeDocument', 'Choisis un type de document.'));
      return;
    }
    if (!this.file()) {
      this.error.set(tr('registerJoinsJustificatif', 'Joins ton justificatif.'));
      return;
    }
    this.sending.set(true);
    this.error.set(null);
    try {
      const depose = await this.verificationRepo.submit({
        nom: this.nom().trim(),
        prenom: this.prenom().trim(),
        matricule: this.matricule().trim() || undefined,
        universite: u.universite,
        filiere: u.filiere,
        niveau: niveauCourt(u.niveau),
        justificatifType: this.justificatifType(),
        file: this.file()!,
      });
      // La garde de routage s'en remet à l'état de vérification : lui laisser
      // « requis » la ferait renvoyer ici, en boucle. On pose donc l'état à
      // partir de la réponse de l'envoi - sans dépendre d'une seconde requête
      // qui pourrait échouer ou traîner -, puis on le confirme auprès du serveur.
      this.verification.state.set(
        verificationDepuisJson({ statut: 'en_attente', resoumissionsRestantes: 0, ...depose, requis: true }),
      );
      await this.router.navigateByUrl('/app/' + AppRoutes.verificationPending, { replaceUrl: true });
      void this.verification.refresh();
    } catch {
      this.error.set(tr('verifErreurEnvoi', 'L’envoi a échoué. Vérifie le fichier et réessaie.'));
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * « Retour ». Tant que l'accès est fermé, la garde renvoie ici de toute autre
   * page : un retour vers l'application ne mènerait nulle part. La seule sortie
   * honnête est de quitter ce compte - par exemple pour en prendre un autre.
   */
  protected async sortir(): Promise<void> {
    if (!this.bloque()) {
      void this.router.navigate(['/app', AppRoutes.profil]);
      return;
    }
    const confirme = await this.actions.confirmer({
      title: tr('verifQuitterTitre', 'Quitter ce compte ?'),
      description: tr('verifQuitterAide', 'Tu pourras te reconnecter plus tard pour envoyer ton justificatif.'),
      confirmLabel: tr('profilDeconnecter', 'Déconnecter'),
      cancelLabel: tr('actionAnnuler', 'Annuler'),
      destructive: true,
      icon: 'logout',
    });
    if (!confirme) return;
    await this.auth.logout();
    void this.router.navigate(['/app']);
  }

  protected allerAccueil(): void {
    void this.router.navigate(['/app', AppRoutes.home]);
  }
}
