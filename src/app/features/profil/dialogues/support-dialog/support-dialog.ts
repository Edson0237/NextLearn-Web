import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { TraductionPipe } from '../../../../core/i18n';
import { tr } from '../../../../core/i18n';
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

  readonly ferme = output<void>();

  protected readonly categories = [
    { value: 'CONNEXION', label: tr('supportCatConnexion', 'Connexion') },
    { value: 'DOCUMENT', label: tr('docTitre', 'Document') },
    { value: 'COMPTE', label: tr('profilCompte', 'Compte') },
    { value: 'BUG', label: tr('pwaCategorieBug', 'Bug') },
    { value: 'AUTRE', label: tr('supportCatAutre', 'Autre') },
  ];

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
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible.');
    } finally {
      this.envoi.set(false);
    }
  }
}
