import { ResultatPin } from '../../../shared/ui/resultat-pin/resultat-pin';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { SecureStorageService } from '../../../core/storage/secure-storage.service';
import { GoogleBouton } from '../../../shared/ui/google-bouton/google-bouton';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { Identite } from '../../../shared/ui/identite/identite';
import { AppRoutes } from '../../../core/router';
import { initiales } from '../../../core/models';

/**
 * Connexion par PIN, étape 1 - traduction de `LoginPinPage`
 * (`lib/domains/auth/presentation/pages/login_pin/login_pin_page.dart`).
 * Le PIN valide n'ouvre pas la session : le backend exige encore le
 * second facteur (`AppRoutes.loginOtp`) avant d'établir quoi que ce soit.
 *
 * L'e-mail se pré-remplit depuis l'utilisateur en cache (dernier compte
 * connecté sur cet appareil, même après une déconnexion qui n'a effacé
 * que le jeton) - une seule fois, pour ne pas écraser une saisie en cours
 * si quelqu'un change d'adresse.
 */
@Component({
  selector: 'app-login-pin',
  standalone: true,
  imports: [TraductionPipe, PinInput, Identite, ResultatPin, GoogleBouton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-pin.html',
  styleUrl: './login-pin.scss',
})
export class LoginPin {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(SecureStorageService);

  private readonly utilisateurCache = this.storage.getUser();

  protected readonly email = signal(this.utilisateurCache?.email ?? '');
  protected readonly pin = signal('');

  /**
   * Où en est la connexion : l'adresse d'abord, puis - si le compte a un PIN
   * - le PIN. Un compte sans PIN reçoit un code par e-mail et ne voit jamais
   * le pavé : le PIN est facultatif.
   */
  protected readonly etape = signal<'email' | 'pin'>('email');
  protected readonly erreur = signal<string | undefined>(undefined);


  /** Ce que la saisie du PIN a donné, montré plein écran avant de poursuivre. */
  protected readonly resultat = signal<
    { etat: 'succes' | 'echec'; titre: string; message: string; suite?: () => void } | null
  >(null);

  protected continuer(): void {
    const suite = this.resultat()?.suite;
    this.resultat.set(null);
    suite?.();
  }

  protected reessayer(): void {
    this.resultat.set(null);
  }

  /** Appareil nouveau d'une adresse gérée par Google : la preuve passe par le bouton Google. */
  protected readonly verificationGoogle = signal(false);

  protected get chargement(): boolean {
    return this.auth.state().isLoading;
  }

  protected get initialesAffichees(): string {
    const u = this.auth.state().user ?? this.utilisateurAffiche();
    // Chaîne vide et non « NL » : c'est elle qui dit à `nl-identite` qu'on
    // ne sait pas encore qui se présente, et qu'il faut montrer la marque.
    return u ? initiales(u) : '';
  }

  /** La photo du dernier compte connu sur cet appareil, s'il en porte une. */
  protected get photoAffichee(): string | undefined {
    return (this.auth.state().user ?? this.utilisateurAffiche())?.avatarUrl;
  }

  protected get accroche(): string {
    const u = this.auth.state().user ?? this.utilisateurAffiche();
    return u ? `Bonjour, ${u.prenom} !` : 'Bienvenue';
  }

  private utilisateurAffiche() {
    const cache = this.utilisateurCache;
    if (!cache) return undefined;
    return this.email().trim().toLowerCase() === cache.email.toLowerCase() ? cache : undefined;
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected onChiffre(d: string): void {
    if (this.pin().length >= 4) return;
    this.erreur.set(undefined);
    const suivant = this.pin() + d;
    this.pin.set(suivant);
    if (suivant.length === 4) void this.soumettre(suivant);
  }

  protected onBackspace(): void {
    if (this.pin().length === 0) return;
    this.erreur.set(undefined);
    this.pin.set(this.pin().slice(0, -1));
  }

  /** Étape 1 : l'adresse. Le serveur dit si c'est le PIN, un code par e-mail ou Google. */
  protected async continuerAvecEmail(): Promise<void> {
    const email = this.email().trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.erreur.set('Entre une adresse e-mail valide.');
      return;
    }
    this.erreur.set(undefined);
    const methode = await this.auth.identifierConnexion(email);
    switch (methode) {
      case 'pin':
        this.pin.set('');
        this.etape.set('pin');
        return;
      case 'otp':
        void this.router.navigateByUrl('/app/' + AppRoutes.loginOtp);
        return;
      case 'google':
        this.verificationGoogle.set(true);
        return;
      default:
        this.erreur.set(this.auth.state().error ?? 'Connexion impossible. Réessaie.');
    }
  }

  protected changerAdresse(): void {
    this.pin.set('');
    this.erreur.set(undefined);
    this.verificationGoogle.set(false);
    this.etape.set('email');
  }

  private async soumettre(pin: string): Promise<void> {
    const email = this.email().trim().toLowerCase();
    if (email === '') {
      this.erreur.set('Entre ton adresse e-mail.');
      this.pin.set('');
      return;
    }

    const issue = await this.auth.loginWithPin(email, pin);
    if (issue === 'google') {
      this.pin.set('');
      this.verificationGoogle.set(true);
      return;
    }
    if (issue === 'otp') {
      // PIN reconnu, mais cet appareil est nouveau : un code part par e-mail.
      this.pin.set('');
      this.resultat.set({
        etat: 'succes',
        titre: 'PIN vérifié',
        message: 'Un code de vérification vient de t’être envoyé par e-mail.',
        suite: () => void this.router.navigateByUrl('/app/' + AppRoutes.loginOtp),
      });
    } else if (issue === 'session') {
      // Appareil déjà connu : aucun code à saisir. La garde de routage voit
      // la session et conduit à l'accueil - ou à la vérification académique
      // si elle est en attente, ce qu'on ne décide pas ici.
      const prenom = this.auth.state().user?.prenom;
      this.pin.set('');
      this.resultat.set({
        etat: 'succes',
        titre: prenom ? `Content de te revoir, ${prenom} !` : 'Connexion réussie',
        message: '',
        suite: () => void this.router.navigate(['/app', AppRoutes.home]),
      });
    } else {
      const message = this.auth.state().error ?? 'PIN incorrect. Réessaie.';
      this.pin.set('');
      this.resultat.set({ etat: 'echec', titre: 'Connexion impossible', message });
    }
  }

  protected allerReinitialisation(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.resetPin);
  }

  protected allerInscription(): void {
    void this.router.navigate(['/app', AppRoutes.register]);
  }
}
