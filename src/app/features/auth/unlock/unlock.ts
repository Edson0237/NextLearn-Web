import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { BiometricService } from '../../../core/auth/biometric.service';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { AppRoutes } from '../../../core/router/app-routes';
import { initiales } from '../../../core/models/user.model';

/**
 * Déverrouillage d'une session active — traduction d'`UnlockPage`
 * (`lib/domains/auth/presentation/pages/unlock/unlock_page.dart`). Ni
 * e-mail à ressaisir ni OTP à attendre : la session tient encore, seul
 * le PIN local le confirme. Le routeur bascule seul vers l'accueil une
 * fois `isLocked` retombé — aucune navigation à faire ici au succès.
 */
@Component({
  selector: 'app-unlock',
  standalone: true,
  imports: [PinInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unlock.html',
  styleUrl: './unlock.scss',
})
export class Unlock {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly biometrie = inject(BiometricService);
  private readonly feuilles = inject(FeuilleActionService);

  protected readonly pin = signal('');
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly biometrieDisponible = signal(false);

  protected get chargement(): boolean {
    return this.auth.state().isLoading;
  }

  protected get initialesAffichees(): string {
    const u = this.auth.state().user;
    return u ? initiales(u) : 'NL';
  }

  protected get accroche(): string {
    const u = this.auth.state().user;
    return u ? `Bon retour, ${u.prenom} !` : 'Bon retour !';
  }

  constructor() {
    void this.initBiometrie();
  }

  /** Propose la biométrie puis la déclenche d'emblée : quelqu'un qui l'a
   * activée pose son doigt, il n'appuie pas sur un bouton avant. */
  private async initBiometrie(): Promise<void> {
    const disponible = await this.biometrie.isAvailable();
    if (!disponible) return;
    this.biometrieDisponible.set(true);
    await this.tenterBiometrie();
  }

  protected async tenterBiometrie(): Promise<void> {
    // Un verrou de tentatives en cours s'applique aussi à la biométrie :
    // sinon il suffirait de passer par le capteur pour le contourner.
    if (this.auth.isPinLocked()) return;
    const ok = await this.biometrie.authenticate();
    if (!ok) return;
    this.auth.unlockWithBiometrics();
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
    const ok = await this.auth.unlockWithPin(pin);
    if (!ok) {
      this.erreur.set(this.auth.state().error ?? 'PIN incorrect. Réessaie.');
      this.pin.set('');
    }
  }

  protected allerReinitialisation(): void {
    void this.router.navigate(['/app', AppRoutes.resetPin]);
  }

  protected async changerDeCompte(): Promise<void> {
    const confirme = await this.feuilles.confirmer({
      title: 'Changer de compte ?',
      description: 'Ce compte sera oublié sur cet appareil. Il faudra te reconnecter avec ton e-mail, ton PIN et un code envoyé par e-mail.',
      confirmLabel: 'Changer de compte',
      cancelLabel: 'Annuler',
      destructive: true,
    });
    if (confirme) await this.auth.forgetDevice();
  }
}
