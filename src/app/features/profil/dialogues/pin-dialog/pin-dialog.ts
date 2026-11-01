import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TraductionPipe } from '../../../../core/i18n';
import { tr } from '../../../../core/i18n';
import { AuthService } from '../../../../core/auth';
import { ToastService } from '../../../../shared/ui/toast/toast';

/**
 * La fenêtre « créer / changer mon code PIN ».
 *
 * Elle porte seule ce qui la concerne - les trois champs, les règles de saisie,
 * l'appel au serveur - et ne dit à la page que deux choses : qu'elle se ferme
 * (`ferme`), et, par le message affiché, que le code est enregistré. Le PIN est
 * facultatif : sans PIN, on le crée sans « code actuel ».
 */
@Component({
  selector: 'nl-pin-dialog',
  standalone: true,
  imports: [TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-dialog.html',
  styleUrl: './pin-dialog.scss',
})
export class PinDialog {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Le compte a-t-il déjà un PIN ? Sinon, la fenêtre sert à en créer un. */
  readonly aUnPin = input(true);
  readonly ferme = output<void>();

  protected readonly ancien = signal('');
  protected readonly nouveau = signal('');
  protected readonly confirmation = signal('');
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly envoi = signal(false);

  protected saisir(champ: 'ancien' | 'nouveau' | 'confirmation', e: Event): void {
    // Quatre chiffres, rien d'autre : le clavier numérique n'y suffit pas (collage).
    const valeur = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    if (champ === 'ancien') this.ancien.set(valeur);
    else if (champ === 'nouveau') this.nouveau.set(valeur);
    else this.confirmation.set(valeur);
    this.erreur.set(undefined);
  }

  /** Le motif de refus de la saisie, ou `undefined` si elle peut partir. */
  protected motifDeRefus(): string | undefined {
    const ancien = this.ancien().trim();
    const nouveau = this.nouveau().trim();
    const aUnPin = this.aUnPin();
    if (aUnPin && ancien.length !== 4) return 'Saisis ton code actuel à 4 chiffres.';
    if (!/^\d{4}$/.test(nouveau)) return 'Le nouveau code doit comporter 4 chiffres.';
    if (nouveau !== this.confirmation().trim()) return 'Les codes ne correspondent pas.';
    if (aUnPin && nouveau === ancien) return 'Le nouveau code doit être différent de l\'ancien.';
    return undefined;
  }

  protected async valider(): Promise<void> {
    const refus = this.motifDeRefus();
    if (refus) {
      this.erreur.set(refus);
      return;
    }

    const avaitUnPin = this.aUnPin();
    this.envoi.set(true);
    const fermees = await this.auth.changerPin(avaitUnPin ? this.ancien().trim() : undefined, this.nouveau().trim());
    this.envoi.set(false);
    if (fermees === null) {
      this.erreur.set(this.auth.state().error ?? 'Changement impossible.');
      return;
    }
    this.ferme.emit();
    this.toast.succes(
      !avaitUnPin
        ? tr('pinCreeConfirmation', 'Code PIN créé.')
        : fermees > 0 ? `Code modifié. ${fermees} appareil(s) déconnecté(s).` : 'Code modifié.',
    );
  }
}
