import { Directive, HostListener, inject, input } from '@angular/core';
import { HapticService } from '../services/haptic';

/**
 * Une surface non-bouton qui doit pourtant se comporter comme un bouton —
 * traduction de `ZonePressable` (`lib/shared/widgets/zone_pressable.dart`),
 * pour les cas où l'élément tapable n'est pas un `<button>` natif (une
 * carte, par exemple, qui a déjà sa propre mise en forme).
 *
 * Un `<button>` ordinaire n'a pas besoin de cette directive : le rôle, le
 * clavier (Entrée/Espace) et le retour visuel (`_native.scss`,
 * `[role='button']:active`) existent déjà nativement. `nlPressable` pose
 * le minimum qui manque à un `<div>` : le rôle, la navigation au clavier,
 * et — optionnel — le retour haptique au tap, comme `ZonePressable.haptique`.
 *
 * Le retour visuel lui-même (l'échelle 0.97 au tap) n'est pas répété ici :
 * `_native.scss` l'applique déjà à tout `[role='button']`, et cette
 * directive pose justement ce rôle.
 */
@Directive({
  selector: '[nlPressable]',
  standalone: true,
  host: {
    role: 'button',
    tabindex: '0',
    class: 'nl-pressable',
  },
})
export class Pressable {
  private readonly haptic = inject(HapticService);

  /** Éteint le retour haptique — `ZonePressable.haptique: false`. */
  readonly nlPressableHaptic = input(true);

  @HostListener('click')
  onClick(): void {
    if (this.nlPressableHaptic()) this.haptic.leger();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    // Un `<div role="button">` n'active rien au clavier par défaut — à la
    // différence d'un `<button>` natif, qui gère déjà Entrée et Espace.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.currentTarget as HTMLElement).click();
    }
  }
}
