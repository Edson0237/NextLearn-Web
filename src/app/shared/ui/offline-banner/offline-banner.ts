import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

/** Bandeau hors-ligne — traduction d'`OfflineBanner` (`offline_banner.dart`). */
@Component({
  selector: 'nl-offline-banner',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nl-icon name="cloud_off" [size]="16" />
    <span>{{ message() }}</span>
  `,
  styleUrl: './offline-banner.scss',
  host: { role: 'status' },
})
export class OfflineBanner {
  readonly offlineCount = input<number>();

  protected readonly message = computed(() => {
    const n = this.offlineCount();
    if (n == null) return 'Mode hors ligne';
    return `Mode hors ligne — ${n} document${n > 1 ? 's' : ''} disponible${n > 1 ? 's' : ''}`;
  });
}
