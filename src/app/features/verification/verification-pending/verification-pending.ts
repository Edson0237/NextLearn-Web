import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TraductionPipe } from '../../../core/i18n';
import { tr } from '../../../core/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { VerificationRepository } from '../../../core/verification';
import { VerificationService } from '../../../core/verification';
import { AuthService } from '../../../core/auth';
import {
  VERIFICATION_AUCUNE,
  VerificationState,
  VerificationStatut,
  demandeAction,
  estApprouve,
} from '../../../core/models';
import { AppRoutes } from '../../../core/router';

type Ton = 'primaire' | 'succes' | 'alerte' | 'danger';

/**
 * Où en est le dossier de vérification : une carte qui dit l'état, la frise de
 * ce qui reste à passer, et - quand l'étudiant doit agir - le bouton pour le faire.
 */
@Component({
  selector: 'nl-verification-pending',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verification-pending.html',
  styleUrl: './verification-pending.scss',
})
export class VerificationPending implements OnInit {
  private readonly router = inject(Router);
  private readonly verificationRepo = inject(VerificationRepository);
  private readonly verification = inject(VerificationService);
  private readonly auth = inject(AuthService);
  private readonly actions = inject(FeuilleActionService);

  protected readonly Statut = VerificationStatut;
  protected readonly loading = signal(true);
  protected readonly status = signal<VerificationState>(VERIFICATION_AUCUNE);

  /** Le dossier est-il entre les mains de l'équipe (reçu ou en examen) ? */
  protected readonly enCours = computed(() => {
    const s = this.status().statut;
    return s === VerificationStatut.enAttente || s === VerificationStatut.enRevue;
  });

  /** L'étape atteinte dans la frise : 1 reçu, 2 en examen, 3 décidé. */
  protected readonly etape = computed(() => {
    switch (this.status().statut) {
      case VerificationStatut.enRevue: return 2;
      case VerificationStatut.approuve:
      case VerificationStatut.rejete: return 3;
      default: return 1;
    }
  });

  protected readonly presentation = computed((): { icone: IconName; ton: Ton } => {
    switch (this.status().statut) {
      case VerificationStatut.approuve: return { icone: 'check_circle', ton: 'succes' };
      case VerificationStatut.rejete: return { icone: 'warning', ton: 'danger' };
      case VerificationStatut.infosComplementairesRequises: return { icone: 'info', ton: 'alerte' };
      case VerificationStatut.requis: return { icone: 'upload_file', ton: 'primaire' };
      default: return { icone: 'schedule', ton: 'primaire' };
    }
  });

  protected readonly depotLe = computed(() => {
    const d = this.status().submittedAt;
    return d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(d) : null;
  });

  async ngOnInit(): Promise<void> {
    try {
      const s = await this.verificationRepo.getMyStatus();
      this.status.set(s);
      // Le service porte l'état que lit la garde de routage : le rafraîchir
      // ici fait disparaître cet écran dès qu'un administrateur a statué,
      // sans que l'étudiant ait à faire quoi que ce soit.
      await this.verification.refresh();
    } catch {
      // Sans réseau : on garde ce que le service savait déjà.
      this.status.set(this.verification.state());
    } finally {
      this.loading.set(false);
    }
  }

  /** L'étudiant doit agir : premier dépôt, complément ou resoumission. */
  protected peutResoumettre(): boolean {
    const etat = this.status();
    return demandeAction(etat.statut) && etat.resoumissionsRestantes > 0;
  }

  protected tentativesTexte(): string {
    const n = this.status().resoumissionsRestantes;
    return n > 1
      ? tr('verifTentativesPlusieurs', 'Il te reste {n} tentatives.').replace('{n}', String(n))
      : tr('verifTentativeUne', 'Il te reste 1 tentative.');
  }

  protected newRequest(): void {
    void this.router.navigate(['/app', AppRoutes.verificationForm]);
  }

  protected continuer(): void {
    void this.router.navigate(['/app', AppRoutes.home]);
  }

  /**
   * « Retour ». Tant que l'accès est fermé, la garde renvoie ici de toute autre
   * page : la seule sortie est de quitter ce compte.
   */
  protected async sortir(): Promise<void> {
    const etat = this.status();
    if (!etat.requis || estApprouve(etat.statut)) {
      void this.router.navigate(['/app', AppRoutes.home]);
      return;
    }
    const confirme = await this.actions.confirmer({
      title: tr('verifQuitterTitre', 'Quitter ce compte ?'),
      description: tr('verifQuitterAidePending', 'Ton dossier reste en cours. Tu pourras te reconnecter pour suivre son avancement.'),
      confirmLabel: tr('profilDeconnecter', 'Déconnecter'),
      cancelLabel: tr('actionAnnuler', 'Annuler'),
      destructive: true,
      icon: 'logout',
    });
    if (!confirme) return;
    await this.auth.logout();
    void this.router.navigate(['/app']);
  }
}
