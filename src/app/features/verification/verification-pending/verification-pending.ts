import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TraductionPipe, tr } from '../../../core/i18n';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { ToastService } from '../../../shared/ui/toast/toast';
import { VerificationRepository, VerificationService } from '../../../core/verification';
import { AuthService } from '../../../core/auth';
import {
  VERIFICATION_AUCUNE,
  VerificationState,
  VerificationStatut,
  demandeAction,
  estApprouve,
} from '../../../core/models';
import { AppRoutes } from '../../../core/router';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';

type Ton = 'primaire' | 'succes' | 'alerte' | 'danger';

const INTERVALLE_SONDAGE_MS = 4000;

/**
 * Où en est le dossier de vérification : une carte qui dit l'état, la frise de
 * ce qui reste à passer, et - quand l'étudiant doit agir - le bouton pour le faire.
 * Actualise l'état en arrière-plan et redirige automatiquement vers l'accueil dès
 * que le compte est validé, sans nécessiter de rafraîchissement manuel de la page.
 */
@Component({
  selector: 'nl-verification-pending',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verification-pending.html',
  styleUrl: './verification-pending.scss',
})
export class VerificationPending implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly verificationRepo = inject(VerificationRepository);
  private readonly verification = inject(VerificationService);
  private readonly auth = inject(AuthService);
  private readonly actions = inject(FeuilleActionService);
  private readonly toast = inject(ToastService);

  protected readonly Statut = VerificationStatut;
  protected readonly loading = signal(true);
  protected readonly status = signal<VerificationState>(VERIFICATION_AUCUNE);

  private sondageInterval: ReturnType<typeof setInterval> | undefined;
  private estDetruit = false;
  private verificationEnCours = false;

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
    await this.verifierStatut(true);
    if (!this.estDetruit && this.enCours()) {
      this.demarrerSondage();
    }
  }

  ngOnDestroy(): void {
    this.estDetruit = true;
    this.arreterSondage();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.enCours() && !this.estDetruit) {
      void this.verifierStatut(false);
    }
  }

  /**
   * Vérifie le statut auprès de l'API. Si validé, redirige automatiquement vers l'accueil.
   */
  protected async verifierStatut(initial = false): Promise<void> {
    if (this.verificationEnCours) return;
    this.verificationEnCours = true;
    if (initial) this.loading.set(true);

    try {
      const s = await this.verificationRepo.getMyStatus();
      if (this.estDetruit) return;

      this.status.set(s);
      this.verification.state.set(s);

      // Si le compte a été approuvé ou n'exige plus de vérification :
      // 1. Mettre à jour le statut utilisateur en cache / signal
      // 2. Notifier l'étudiant via un toast de succès
      // 3. Rediriger immédiatement vers l'accueil PWA sans refresh manuel
      if (estApprouve(s.statut) || !s.requis) {
        this.arreterSondage();
        this.auth.marquerCompteVerifie();
        this.toast.succes(tr('pwaCompteVerifie', 'Ton compte a été validé ! Bienvenue sur NextLearn.'));
        void this.router.navigate(['/app', AppRoutes.home], { replaceUrl: true });
        return;
      }

      // Si le dossier a basculé vers un statut exigeant une action (rejet ou complément)
      if (!this.enCours()) {
        this.arreterSondage();
        this.auth.updateVerificationStatus(s.statut as any);
      }
    } catch {
      if (initial && !this.estDetruit) {
        this.status.set(this.verification.state());
      }
    } finally {
      this.verificationEnCours = false;
      if (initial && !this.estDetruit) {
        this.loading.set(false);
      }
    }
  }

  private demarrerSondage(): void {
    this.arreterSondage();
    this.sondageInterval = setInterval(() => {
      if (this.estDetruit) {
        this.arreterSondage();
        return;
      }
      void this.verifierStatut(false);
    }, INTERVALLE_SONDAGE_MS);
  }

  private arreterSondage(): void {
    if (this.sondageInterval !== undefined) {
      clearInterval(this.sondageInterval);
      this.sondageInterval = undefined;
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
    this.arreterSondage();
    await this.auth.logout();
    void this.router.navigate(['/app']);
  }
}
