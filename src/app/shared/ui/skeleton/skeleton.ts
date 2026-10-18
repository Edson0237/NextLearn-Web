import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Squelette de chargement — traduction de `ShimmerCard`
 * (`lib/core/ux/shimmer_card.dart`), balayage diagonal de `bg-secondary`
 * vers `bg-primary`. Hauteur/largeur en valeur CSS libre (`'120px'`,
 * `'100%'`...), comme les `double height`/`double? width` Flutter.
 */
@Component({
  selector: 'nl-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  styleUrl: './skeleton.scss',
  host: {
    '[style.height]': 'height()',
    '[style.width]': 'width()',
    '[style.border-radius]': 'radius()',
  },
})
export class Skeleton {
  readonly height = input('120px');
  readonly width = input('100%');
  readonly radius = input('var(--radius-lg)');
}
