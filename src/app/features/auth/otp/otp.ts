import { ChangeDetectionStrategy, Component, computed, ElementRef, effect, inject, OnDestroy, signal, viewChildren } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router';
import { DemandeOtp, enFile, StatutDemandeOtp, determinerDestinationVerification } from '../../../core/models';
import { ParcoursOtp } from '../../../core/models';
import { VerificationService } from '../../../core/verification';

/** La file se réveille à la minute ; interroger plus souvent ne montrerait
 * rien de neuf. */
const PERIODE_SONDAGE_MS = 30_000;

/**
 * Code de vérification - traduction d'`OtpPage`
 * (`lib/domains/auth/presentation/pages/register/otp_page.dart`), à la
 * fois pour l'inscription et pour le second facteur d'une connexion.
 *
 * **Ce que la démarche mémorisée décide, pas la route** : `estConnexion()`
 * lit `auth.state().parcoursOtp`, pas le `isLogin2fa` de la route - la
 * source documente l'incident précis que cet ordre évite (un jeton de
 * connexion envoyé à `verify-otp`, le serveur refusant sur le type du
 * jeton sans jamais lire les six chiffres).
 *
 * Deux vues : la saisie à six cases quand un code est parti, la file
 * d'attente quand il ne l'est pas encore - jamais les deux à la fois, un
 * compte à rebours y serait un mensonge (voir `FileAttenteOtp`, source).
 */
@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp.html',
  styleUrl: './otp.scss',
})
export class Otp implements OnDestroy {
  protected readonly StatutDemandeOtp = StatutDemandeOtp;

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly verification = inject(VerificationService);
  private readonly feuilles = inject(FeuilleActionService);
  private readonly isLogin2faParRoute = inject(ActivatedRoute).snapshot.data['isLogin2fa'] === true;

  private readonly cases = viewChildren<ElementRef<HTMLInputElement>>('case');

  protected readonly chiffres = signal<string[]>(['', '', '', '', '', '']);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly actualisation = signal(false);
  protected readonly codeComplet = computed(() => this.chiffres().every((c) => c !== ''));

  private sondage: ReturnType<typeof setInterval> | undefined;

  protected get demande(): DemandeOtp | undefined {
    return this.auth.state().demandeOtp;
  }

  protected get enFileAttente(): boolean {
    const d = this.demande;
    return !!d && (enFile(d) || d.statut === StatutDemandeOtp.refuse);
  }

  constructor() {
    // Le sondage suit l'état plutôt que d'être lancé une fois pour toutes :
    // démarrer un minuteur pour un code déjà parti interrogerait le serveur
    // pour rien.
    effect(() => {
      const d = this.auth.state().demandeOtp;
      const doitSonder = !!d && enFile(d);
      if (doitSonder && this.sondage === undefined) {
        this.sondage = setInterval(() => void this.actualiserPosition(), PERIODE_SONDAGE_MS);
      } else if (!doitSonder && this.sondage !== undefined) {
        clearInterval(this.sondage);
        this.sondage = undefined;
      }
    });
  }

  protected estConnexion(): boolean {
    switch (this.auth.state().parcoursOtp) {
      case ParcoursOtp.connexion: return true;
      case ParcoursOtp.inscription: return false;
      default: return this.isLogin2faParRoute;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.sondage);
  }

  protected async actualiserPosition(): Promise<void> {
    this.actualisation.set(true);
    await this.auth.rafraichirDemandeOtp();
    this.actualisation.set(false);
  }

  /** Angular n'autorise pas les assertions de type (`as`) dans un gabarit. */
  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected saisirChiffre(index: number, valeur: string): void {
    const chiffre = valeur.replace(/\D/g, '').slice(-1);
    const copie = [...this.chiffres()];
    copie[index] = chiffre;
    this.chiffres.set(copie);

    if (chiffre !== '' && index < 5) {
      this.cases()[index + 1]?.nativeElement.focus();
    }
    if (copie.every((c) => c !== '')) void this.verifier();
  }

  protected surCollage(e: ClipboardEvent): void {
    const texte = e.clipboardData?.getData('text') ?? '';
    const chiffresColles = texte.replace(/\D/g, '').slice(0, 6).split('');
    if (chiffresColles.length === 0) return;
    e.preventDefault();
    const copie = ['', '', '', '', '', ''];
    chiffresColles.forEach((c, i) => (copie[i] = c));
    this.chiffres.set(copie);
    const dernier = Math.min(chiffresColles.length, 6) - 1;
    this.cases()[Math.max(dernier, 0)]?.nativeElement.focus();
    if (copie.every((c) => c !== '')) void this.verifier();
  }

  protected async verifier(): Promise<void> {
    if (this.chargement()) return;
    const code = this.chiffres().join('');
    if (code.length < 6) {
      this.erreur.set(tr('otpCodeIncomplet', 'Saisis les 6 chiffres du code.'));
      return;
    }

    this.chargement.set(true);
    this.erreur.set(undefined);

    try {
      const estConnexion = this.estConnexion();
      const ok = estConnexion ? await this.auth.verifyLoginOtp(code) : await this.auth.verifyOtp(code);
      if (ok) {
        const dest = determinerDestinationVerification(this.auth.state().user, this.verification.state());
        void this.router.navigateByUrl('/app/' + (dest ?? AppRoutes.home));
      } else {
        const errServeur = this.auth.state().error;
        this.erreur.set(errServeur || tr('otpCodeIncorrect', 'Code incorrect. Réessaie.'));
        this.chiffres.set(['', '', '', '', '', '']);
        this.cases()[0]?.nativeElement.focus();
      }
    } catch (e: any) {
      this.erreur.set(e?.message || tr('erreurReseau', 'Erreur de connexion. Vérifie ton réseau et réessaie.'));
    } finally {
      this.chargement.set(false);
    }
  }

  protected async renvoyer(): Promise<void> {
    await this.auth.resendOtp();
  }

  protected async demanderAbandon(): Promise<void> {
    const estConnexion = this.estConnexion();
    const confirme = await this.feuilles.confirmer({
      title: tr('pwaAbandonnerQuestion', 'Abandonner ?'),
      description: estConnexion
        ? 'Tu devras te reconnecter depuis le début.'
        : "Tu devras reprendre l'inscription depuis le début.",
      confirmLabel: tr('otpAbandonQuitter', 'Abandonner'),
      cancelLabel: tr('quitterAppRester', 'Rester'),
      destructive: true,
    });
    if (!confirme) return;

    this.auth.abandonnerParcoursOtp();
    void this.router.navigate(['/app', estConnexion ? AppRoutes.login : AppRoutes.register]);
  }

  protected traitementEstime(): string {
    const jours = this.demande?.joursEstimes;
    if (jours == null) return 'bientôt';
    if (jours <= 0) return "aujourd'hui";
    if (jours === 1) return 'demain';
    return `dans ${jours} jours`;
  }
}
