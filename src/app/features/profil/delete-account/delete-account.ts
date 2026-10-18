import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfilRepository } from '../../../core/profil/profil-repository';
import { SuppressionRapport } from '../../../core/profil/profil.model';
import { AppRoutes } from '../../../core/router/app-routes';
import { Failure } from '../../../core/models/failure.model';

/**
 * Suppression du compte en deux étapes — traduction de `DeleteAccountPage`
 * (`lib/domains/profil/presentation/pages/delete_account/delete_account_page.dart`).
 */
@Component({
  selector: 'app-delete-account',
  standalone: true,
  imports: [Icon],
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
  protected readonly pin = signal('');
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly envoi = signal(false);
  protected readonly rapport = signal<SuppressionRapport | undefined>(undefined);

  protected readonly consequences = computed(() => [
    { icon: 'bookmark', label: 'Tes documents favoris et signets seront supprimés.' },
    { icon: 'timeline', label: 'Toute ta progression (streak, stats) disparaîtra.' },
    { icon: 'quiz', label: 'Tes épreuves et annotations ne seront plus accessibles.' },
    { icon: 'badge', label: 'Ton identité et ton profil seront retirés.' },
    { icon: 'forum', label: 'Tes conversations et signalements seront clos.' },
  ]);

  protected retour(): void {
    if (this.etape() === 2) {
      this.etape.set(1);
    } else {
      this.location.back();
    }
  }

  protected continuer(): void {
    this.etape.set(2);
    this.pin.set('');
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
    if (this.pin().length !== 4) return;
    this.envoi.set(true);
    this.erreur.set(undefined);
    try {
      const rapport = await this.repo.deleteAccount(this.pin());
      this.rapport.set(rapport);
      await this.auth.forgetDevice();
      this.toast.succes('Compte supprimé.');
      void this.router.navigate(['/app']);
    } catch (e) {
      this.pin.set('');
      this.erreur.set(e instanceof Failure ? e.message : 'Suppression impossible.');
    } finally {
      this.envoi.set(false);
    }
  }
}
