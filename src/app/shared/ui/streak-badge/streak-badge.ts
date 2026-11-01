import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { TraductionPipe } from '../../../core/i18n';

/**
 * Badge de série - traduction de `StreakBadge` (`streak_badge.dart`).
 * Invisible si `streak` vaut 0. L'animation d'entrée (mise à l'échelle,
 * rebond) vit dans `streak-badge.scss`, appliquée une fois au montage.
 */
@Component({
  selector: 'nl-streak-badge',
  standalone: true,
  imports: [Icon, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './streak-badge.html',
  styleUrl: './streak-badge.scss',
  host: {
    '[class.nl-streak--compact]': 'compact()',
    '[class.nl-streak--animee]': 'animate()',
    '[hidden]': 'streak() === 0',
  },
})
export class StreakBadge {
  readonly streak = input.required<number>();
  readonly animate = input(true);
  readonly compact = input(false);
}
