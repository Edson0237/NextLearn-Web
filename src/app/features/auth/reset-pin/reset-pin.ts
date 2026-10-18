import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SecureStorageService } from '../../../core/storage/secure-storage.service';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';
import { ParcoursOtp } from '../../../core/models/parcours-otp.model';
import { estAuthentifie } from '../../../core/auth/auth.model';
import { validerPin } from '../../../core/auth/pin-policy';

type Etape = 'email' | 'code' | 'nouveauPin';

/**
 * Récupération d'un PIN oublié — traduction de `ResetPinPage`
 * (`lib/domains/auth/presentation/pages/reset_pin/reset_pin_page.dart`),
 * en trois temps : adresse, code, nouveau PIN. Remplace l'ancienne
 * impasse qui aurait fait recréer un compte — perdant au passage
 * bibliothèque et vérification académique.
 *
 * Reprend directement à l'étape « code » si une démarche de
 * réinitialisation est déjà enregistrée (retour après avoir relevé sa
 * boîte mail) : redemander l'adresse relancerait un second envoi, et le
 * premier code deviendrait caduc.
 */
@Component({
  selector: 'app-reset-pin',
  standalone: true,
  imports: [PinInput, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-pin.html',
  styleUrl: './reset-pin.scss',
})
export class ResetPin {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(SecureStorageService);
  private readonly feuilles = inject(FeuilleActionService);

  protected readonly reprise = this.auth.state().parcoursOtp === ParcoursOtp.reinitialisation;
  protected readonly etape = signal<Etape>(this.reprise ? 'code' : 'email');

  protected readonly email = signal(this.storage.getUser()?.email ?? '');
  protected readonly code = signal('');
  protected readonly erreur = signal<string | undefined>(undefined);

  private pin = '';
  private confirmation = '';
  protected readonly confirmant = signal(false);
  protected readonly saisiePin = signal('');

  protected get chargement(): boolean {
    return this.auth.state().isLoading;
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async envoyerCode(): Promise<void> {
    const email = this.email().trim();
    if (email === '' || !email.includes('@')) {
      this.erreur.set('Entre une adresse e-mail valide.');
      return;
    }
    const ok = await this.auth.requestPinReset(email);
    if (ok) {
      this.erreur.set(undefined);
      this.etape.set('code');
    } else {
      this.erreur.set(this.auth.state().error);
    }
  }

  protected validerCode(): void {
    if (this.code().trim().length !== 6) {
      this.erreur.set('Le code contient 6 chiffres.');
      return;
    }
    this.erreur.set(undefined);
    this.etape.set('nouveauPin');
  }

  protected onChiffrePin(d: string): void {
    this.erreur.set(undefined);
    if (!this.confirmant()) {
      if (this.pin.length < 4) this.pin += d;
      this.saisiePin.set(this.pin);
      if (this.pin.length === 4) {
        const refus = validerPin(this.pin);
        if (refus) {
          this.erreur.set(refus);
          this.pin = '';
          this.saisiePin.set('');
        } else {
          this.confirmant.set(true);
        }
      }
      return;
    }

    if (this.confirmation.length < 4) this.confirmation += d;
    this.saisiePin.set(this.confirmation);
    if (this.confirmation.length === 4) void this.soumettreNouveauPin();
  }

  protected onBackspacePin(): void {
    this.erreur.set(undefined);
    if (this.confirmant()) {
      if (this.confirmation.length > 0) {
        this.confirmation = this.confirmation.slice(0, -1);
      } else {
        this.confirmant.set(false);
        this.pin = this.pin.slice(0, -1);
        this.saisiePin.set(this.pin);
        return;
      }
    } else if (this.pin.length > 0) {
      this.pin = this.pin.slice(0, -1);
    }
    this.saisiePin.set(this.confirmant() ? this.confirmation : this.pin);
  }

  private reinitialiserSaisiePin(): void {
    this.pin = '';
    this.confirmation = '';
    this.confirmant.set(false);
    this.saisiePin.set('');
  }

  private async soumettreNouveauPin(): Promise<void> {
    if (this.pin !== this.confirmation) {
      this.erreur.set('Les codes ne correspondent pas. Réessaie.');
      this.reinitialiserSaisiePin();
      return;
    }

    const ok = await this.auth.confirmPinReset(this.code().trim(), this.pin);
    if (ok) {
      // Le serveur ouvre la session en même temps qu'il remplace le PIN :
      // redemander un second code pour la connexion qui suivrait
      // consommerait un envoi pour une preuve déjà faite.
      const connecte = estAuthentifie(this.auth.state());
      void this.router.navigate(['/app', connecte ? AppRoutes.home : AppRoutes.login]);
      return;
    }

    // Le code est le suspect le plus probable — un PIN qui, lui, était
    // valide ne devrait pas être redemandé.
    this.erreur.set(this.auth.state().error);
    this.etape.set('code');
    this.reinitialiserSaisiePin();
  }

  protected async quitter(): Promise<void> {
    if (this.auth.state().parcoursOtp !== ParcoursOtp.reinitialisation) {
      void this.router.navigate(['/app', AppRoutes.login]);
      return;
    }

    const confirme = await this.feuilles.confirmer({
      title: 'Abandonner ?',
      description: 'Le code déjà envoyé ne servira plus. Tu devras relancer la récupération de ton PIN et en redemander un.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Rester',
      destructive: true,
    });
    if (!confirme) return;

    this.auth.abandonnerParcoursOtp();
    void this.router.navigate(['/app', AppRoutes.login]);
  }
}
