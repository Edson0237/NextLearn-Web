import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Surface de carte générique — le fond, le rayon (`AppRadius.md`, 14px) et
 * l'ombre douce (`AppColors.shadowCard`) que presque tous les écrans de
 * contenu utilisent (document, épreuve, notification...). Le contenu
 * propre à chaque métier reste hors de ce composant, par projection.
 */
@Component({
  selector: 'nl-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styleUrl: './card.scss',
  host: {
    '[class.nl-card--pressable]': 'pressable()',
  },
})
export class Card {
  /** Pose un retour tactile (`:active`) quand la carte est elle-même tapable. */
  readonly pressable = input(false);
}
