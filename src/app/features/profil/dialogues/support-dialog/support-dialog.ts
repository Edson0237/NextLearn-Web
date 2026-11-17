import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { tr, TraductionPipe, TraductionService } from '../../../../core/i18n';
import { Failure } from '../../../../core/models';
import { SupportRepository } from '../../../../core/profil';
import { ToastService } from '../../../../shared/ui/toast/toast';

/** La fenêtre « signaler un problème » : un ticket envoyé à l'équipe d'assistance. */
@Component({
  selector: 'nl-support-dialog',
  standalone: true,
  imports: [TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-dialog.html',
  styleUrl: './support-dialog.scss',
})
export class SupportDialog {
  private readonly support = inject(SupportRepository);
  private readonly toast = inject(ToastService);
  private readonly traductions = inject(TraductionService);

  readonly ferme = output<void>();

  protected readonly categories = computed(() => {
    this.traductions.langue();
    this.traductions.aDesMessages();
    return [
      { value: 'CONNEXION', label: this.traductions.t('supportCatConnexion', undefined, 'Connexion') },
      { value: 'DOCUMENT', label: this.traductions.t('supportCatDocument', undefined, 'Document') },
      { value: 'COMPTE', label: this.traductions.t('supportCatCompte', undefined, 'Compte') },
      { value: 'BUG', label: this.traductions.t('supportCatBug', undefined, "Bug de l'application") },
      { value: 'AUTRE', label: this.traductions.t('supportCatAutre', undefined, 'Autre') },
    ];
  });

  protected readonly categorie = signal('CONNEXION');
  protected readonly sujet = signal('');
  protected readonly message = signal('');
  protected readonly envoi = signal(false);

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected peutEnvoyer(): boolean {
    return !this.envoi() && this.sujet().trim().length > 0 && this.message().trim().length > 0;
  }

  protected async envoyer(): Promise<void> {
    const sujet = this.sujet().trim();
    const message = this.message().trim();
    if (!sujet || !message) return;
    this.envoi.set(true);
    try {
      await this.support.createTicket(this.categorie(), sujet, message);
      this.ferme.emit();
      this.toast.succes(tr('pwaSignalementEnvoye', 'Signalement envoyé.'));
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : tr('signalerEnvoiImpossible', 'Envoi impossible.'));
    } finally {
      this.envoi.set(false);
    }
  }
}
