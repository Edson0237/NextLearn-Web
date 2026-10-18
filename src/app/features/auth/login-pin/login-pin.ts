import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SecureStorageService } from '../../../core/storage/secure-storage.service';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { AppRoutes } from '../../../core/router/app-routes';
import { initiales } from '../../../core/models/user.model';

/**
 * Connexion par PIN, étape 1 — traduction de `LoginPinPage`
 * (`lib/domains/auth/presentation/pages/login_pin/login_pin_page.dart`).
 * Le PIN valide n'ouvre pas la session : le backend exige encore le
 * second facteur (`AppRoutes.loginOtp`) avant d'établir quoi que ce soit.
 *
 * L'e-mail se pré-remplit depuis l'utilisateur en cache (dernier compte
 * connecté sur cet appareil, même après une déconnexion qui n'a effacé
 * que le jeton) — une seule fois, pour ne pas écraser une saisie en cours
 * si quelqu'un change d'adresse.
 */
@Component({
  selector: 'app-login-pin',
  standalone: true,
  imports: [PinInput],
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
  protected readonly erreur = signal<string | undefined>(undefined);

  protected get chargement(): boolean {
    return this.auth.state().isLoading;
  }

  protected get initialesAffichees(): string {
    const u = this.auth.state().user ?? this.utilisateurAffiche();
    return u ? initiales(u) : 'NL';
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

  private async soumettre(pin: string): Promise<void> {
    const email = this.email().trim();
    if (email === '') {
      this.erreur.set('Entre ton adresse e-mail.');
      this.pin.set('');
      return;
    }

    const ok = await this.auth.loginWithPin(email, pin);
    if (ok) {
      void this.router.navigate(['/app', AppRoutes.loginOtp]);
    } else {
      this.erreur.set(this.auth.state().error ?? 'PIN incorrect. Réessaie.');
      this.pin.set('');
    }
  }

  protected allerReinitialisation(): void {
    void this.router.navigate(['/app', AppRoutes.resetPin]);
  }

  protected allerInscription(): void {
    void this.router.navigate(['/app', AppRoutes.register]);
  }
}
