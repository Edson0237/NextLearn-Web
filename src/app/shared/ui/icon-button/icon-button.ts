import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icon-paths';
import { HapticService } from '../../services/haptic';

/**
 * Un bouton réduit à son icône, avec une zone sensible de 48px quelle que
 * soit la taille du dessin — traduction d'`IconePressable`
 * (`lib/shared/widgets/zone_pressable.dart`).
 *
 * `ariaLabel` n'est pas optionnel : côté Flutter, `semantique` est un
 * paramètre requis, précisément parce qu'une icône seule n'a pas de texte
 * à annoncer. Angular ne peut pas imposer ça à la compilation comme Dart
 * le fait (`required`), donc `input.required` est le plus proche
 * équivalent — l'oubli devient une erreur de build, pas une icône muette
 * découverte à l'usage.
 */
@Component({
  selector: 'button[nlIconButton]',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nl-icon [name]="icon()" [size]="iconSize()" />`,
  styleUrl: './icon-button.scss',
  host: {
    type: 'button',
    '[attr.aria-label]': 'ariaLabel()',
    '(click)': 'onClick()',
  },
})
export class IconButton {
  private readonly haptic = inject(HapticService);

  readonly icon = input.required<IconName>();
  readonly ariaLabel = input.required<string>();
  readonly iconSize = input(22);
  readonly haptics = input(true);

  protected onClick(): void {
    if (this.haptics()) this.haptic.leger();
  }
}
