import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

const LONGUEUR_PIN = 4;
const RANGEES = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

/**
 * Saisie du code à 4 chiffres — traduction de `PinInputWidget`
 * (`pin_input_widget.dart`). Points de progression, clavier numérique,
 * biométrie optionnelle, erreur annoncée en direct.
 *
 * `aria-live="polite"` sur le compteur de points : sans lui, quelqu'un qui
 * n'y voit pas saisit son code à l'aveugle, sans savoir combien de
 * chiffres sont déjà entrés — même raison que le `Semantics(liveRegion:)`
 * côté Flutter.
 */
@Component({
  selector: 'nl-pin-input',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-input.html',
  styleUrl: './pin-input.scss',
})
export class PinInput {
  readonly pin = input.required<string>();
  readonly error = input<string>();
  readonly isLoading = input(false);
  readonly withBiometric = input(false);

  readonly digit = output<string>();
  readonly backspace = output<void>();
  readonly biometric = output<void>();

  protected readonly rangees = RANGEES;
  protected readonly longueur = LONGUEUR_PIN;

  protected readonly points = computed(() =>
    Array.from({ length: LONGUEUR_PIN }, (_, i) => i < this.pin().length),
  );

  protected readonly libelleCompteur = computed(() =>
    this.pin().length === 0
      ? `Aucun chiffre saisi sur ${LONGUEUR_PIN}`
      : `${this.pin().length} chiffre${this.pin().length > 1 ? 's' : ''} saisi${this.pin().length > 1 ? 's' : ''} sur ${LONGUEUR_PIN}`,
  );

  protected readonly peutSaisir = computed(() => this.pin().length < LONGUEUR_PIN);
  protected readonly peutEffacer = computed(() => this.pin().length > 0);
}
