import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { tr } from '../../../core/i18n';
import { TraductionPipe } from '../../../core/i18n';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AuthService } from '../../../core/auth';
import { ProfilRepository } from '../../../core/profil';
import { SuppressionRapport } from '../../../core/profil';
import { AppRoutes } from '../../../core/router';
import { Failure } from '../../../core/models';

/**
 * Suppression du compte en deux étapes - traduction de `DeleteAccountPage`
 * (`lib/domains/profil/presentation/pages/delete_account/delete_account_page.dart`).
 */
@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-account.html',
  styleUrl: './delete-account.scss',
})
export class DeleteAccount {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly repo = inject(ProfilRepository);
  private readonly toast = inject(ToastService);

  protected readonly etape = signal<1 | 2>(1);

  /** Le champ de saisie de l'étape 2 (PIN ou mot), quel qu'il soit. */
  private readonly champ = viewChild<ElementRef<HTMLInputElement>>('champ');

  constructor() {
    // Le champ du PIN est invisible (les bulles le représentent) : sans focus,
    // les touches ne vont nulle part. On le prend dès qu'il apparaît.
    effect(() => this.champ()?.nativeElement.focus());
  }

  protected focaliser(): void {
    this.champ()?.nativeElement.focus();
  }
  protected readonly pin = signal('');
  /** Ce que le serveur demande pour confirmer ; `undefined` tant qu'on ne le sait pas. */
  protected readonly infos = signal<{ pinRequis: boolean; motConfirmation: string } | undefined>(undefined);
  protected readonly mot = signal('');
  protected readonly motValide = computed(
    () => this.mot().trim().toUpperCase() === (this.infos()?.motConfirmation ?? 'SUPPRIMER'),
  );
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly envoi = signal(false);
  protected readonly rapport = signal<SuppressionRapport | undefined>(undefined);

  protected readonly consequences = computed((): { icon: IconName; label: string }[] => [
    { icon: 'bookmark', label: tr('pwaFavorisSupprimes', 'Tes documents favoris et signets seront supprimés.') },
    { icon: 'timeline', label: tr('pwaProgressionDisparait', 'Toute ta progression (streak, stats) disparaîtra.') },
    { icon: 'quiz', label: tr('pwaEpreuvesInaccessibles', 'Tes épreuves et annotations ne seront plus accessibles.') },
    { icon: 'badge', label: tr('pwaIdentiteRetiree', 'Ton identité et ton profil seront retirés.') },
    { icon: 'forum', label: tr('pwaConversationsCloses', 'Tes conversations et signalements seront clos.') },
  ]);

  protected retour(): void {
    if (this.etape() === 2) {
      this.etape.set(1);
    } else {
      this.location.back();
    }
  }

  protected async continuer(): Promise<void> {
    this.pin.set('');
    this.mot.set('');
    this.erreur.set(undefined);
    try {
      this.infos.set(await this.repo.infosSuppression());
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Suppression impossible.');
      return;
    }
    this.etape.set(2);
  }

  protected saisirMot(e: Event): void {
    this.mot.set((e.target as HTMLInputElement).value);
    this.erreur.set(undefined);
  }

  protected saisirPin(e: Event): void {
    const valeur = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    this.pin.set(valeur);
    this.erreur.set(undefined);
    if (valeur.length === 4) {
      void this.supprimer();
    }
  }

  protected async supprimer(): Promise<void> {
    const avecPin = this.infos()?.pinRequis ?? true;
    if (avecPin ? this.pin().length !== 4 : !this.motValide()) return;
    this.envoi.set(true);
    this.erreur.set(undefined);
    try {
      const rapport = await this.repo.deleteAccount(avecPin ? { pin: this.pin() } : { confirmation: this.mot().trim() });
      this.rapport.set(rapport);
      await this.auth.forgetDevice();
      this.toast.succes(tr('pwaCompteSupprime', 'Compte supprimé.'));
      void this.router.navigate(['/app']);
    } catch (e) {
      this.pin.set('');
      this.mot.set('');
      this.erreur.set(e instanceof Failure ? e.message : 'Suppression impossible.');
    } finally {
      this.envoi.set(false);
    }
  }
}
