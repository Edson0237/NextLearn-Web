import { ResultatPin } from '../../../shared/ui/resultat-pin/resultat-pin';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { tr } from '../../../core/i18n/traduction.service';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { BiometricService } from '../../../core/auth/biometric.service';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { Identite } from '../../../shared/ui/identite/identite';
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
  imports: [TraductionPipe, PinInput, Identite, ResultatPin],
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
    // Chaîne vide et non « NL » : c'est elle qui dit à `nl-identite` qu'on
    // ne sait pas encore qui se présente, et qu'il faut montrer la marque.
    return u ? initiales(u) : '';
  }

  /** La photo du compte, quand il en porte une. */
  protected get photoAffichee(): string | undefined {
    return this.auth.state().user?.avatarUrl;
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
    void this.router.navigate(['/app', AppRoutes.home]);
  }

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
    this.pin.set('');
    if (ok) {
      this.resultat.set({
        etat: 'succes',
        titre: 'Déverrouillé',
        message: '',
        suite: () => void this.router.navigate(['/app', AppRoutes.home]),
      });
      return;
    }
    this.resultat.set({
      etat: 'echec',
      titre: 'PIN incorrect',
      message: this.auth.state().error ?? 'Le code saisi n’est pas le bon. Réessaie.',
    });
  }

  protected allerReinitialisation(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.resetPin);
  }

  protected async changerDeCompte(): Promise<void> {
    const confirme = await this.feuilles.confirmer({
      title: tr('authChangerCompteTitre', 'Changer de compte ?'),
      description: tr('authChangerCompteCorps', 'Ce compte sera oublié sur cet appareil. Il faudra te reconnecter avec ton e-mail, ton PIN et un code envoyé par e-mail.'),
      confirmLabel: tr('authChangerCompte', 'Changer de compte'),
      cancelLabel: tr('actionAnnuler', 'Annuler'),
      destructive: true,
    });
    if (confirme) await this.auth.forgetDevice();
  }
}
