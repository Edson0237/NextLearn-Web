import { ResultatPin } from '../../../shared/ui/resultat-pin/resultat-pin';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth';
import { validerPin } from '../../../core/auth';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';

/**
 * Création du PIN - traduction de `PinSetupPage`
 * (`lib/domains/auth/presentation/pages/register/pin_setup_page.dart`).
 * Un refus de `validerPin` tombe à la fin de la PREMIÈRE saisie, avant la
 * confirmation : faire taper deux fois un code qu'on s'apprête à rejeter
 * n'aiderait personne.
 */
@Component({
  selector: 'app-pin-setup',
  standalone: true,
  imports: [TraductionPipe, PinInput, Icon, ResultatPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-setup.html',
  styleUrl: './pin-setup.scss',
})
export class PinSetup {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly feuilles = inject(FeuilleActionService);

  private pin = '';
  private confirmation = '';

  protected readonly confirmant = signal(false);
  protected readonly saisieActuelle = signal('');
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly chargement = signal(false);

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

  protected onChiffre(d: string): void {
    this.erreur.set(undefined);
    if (!this.confirmant()) {
      if (this.pin.length < 4) this.pin += d;
      this.saisieActuelle.set(this.pin);
      if (this.pin.length === 4) {
        const refus = validerPin(this.pin);
        if (refus) {
          this.erreur.set(refus);
          this.pin = '';
          this.saisieActuelle.set('');
        } else {
          // Le pavé se bloque dès que quatre chiffres sont affichés : sans
          // remise à zéro, la confirmation ne pouvait plus être saisie et
          // l'inscription ne se terminait jamais.
          this.confirmant.set(true);
          this.saisieActuelle.set('');
        }
      }
      return;
    }

    if (this.confirmation.length < 4) this.confirmation += d;
    this.saisieActuelle.set(this.confirmation);
    if (this.confirmation.length === 4) void this.soumettre();
  }

  protected onBackspace(): void {
    this.erreur.set(undefined);
    if (this.confirmant()) {
      if (this.confirmation.length > 0) {
        this.confirmation = this.confirmation.slice(0, -1);
      } else {
        this.confirmant.set(false);
        this.pin = this.pin.slice(0, -1);
        this.saisieActuelle.set(this.pin);
        return;
      }
    } else if (this.pin.length > 0) {
      this.pin = this.pin.slice(0, -1);
    }
    this.saisieActuelle.set(this.confirmant() ? this.confirmation : this.pin);
  }

  private async soumettre(): Promise<void> {
    if (this.pin !== this.confirmation) {
      this.erreur.set('Les codes ne correspondent pas. Réessaie.');
      this.pin = '';
      this.confirmation = '';
      this.confirmant.set(false);
      this.saisieActuelle.set('');
      return;
    }

    this.chargement.set(true);
    const ok = await this.auth.setupPin(this.pin);
    this.chargement.set(false);

    this.pin = '';
    this.confirmation = '';
    this.confirmant.set(false);
    this.saisieActuelle.set('');
    if (ok) {
      this.resultat.set({
        etat: 'succes',
        titre: 'Ton compte est prêt',
        message: 'Ton PIN est enregistré. Bienvenue sur NextLearn !',
        suite: () => void this.router.navigate(['/app', AppRoutes.home]),
      });
    } else {
      this.resultat.set({
        etat: 'echec',
        titre: 'PIN non enregistré',
        message: this.auth.state().error ?? 'Une erreur est survenue. Réessaie.',
      });
    }
  }

  /** Partir d'ici laisse un compte vérifié mais sans PIN - reprendre
   * l'inscription avec la même adresse permet d'y revenir, le serveur
   * sait la reprendre. */
  protected async demanderAbandon(): Promise<void> {
    const confirme = await this.feuilles.confirmer({
      title: tr('pwaAbandonnerQuestion', 'Abandonner ?'),
      description: "Tu devras reprendre l'inscription depuis le début.",
      confirmLabel: tr('otpAbandonQuitter', 'Abandonner'),
      cancelLabel: tr('quitterAppRester', 'Rester'),
      destructive: true,
    });
    if (!confirme) return;

    this.auth.abandonnerParcoursOtp();
    void this.router.navigate(['/app', AppRoutes.login]);
  }
}
