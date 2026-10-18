import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Barre de progression de lecture — traduction de `ReadingProgressBar`
 * (`lib/shared/widgets/reading_progress_bar.dart`). Vire au vert et son
 * étiquette passe à « Lu ✓ » une fois le document terminé.
 */
@Component({
  selector: 'nl-reading-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  host: {
    role: 'progressbar',
    '[attr.aria-valuenow]': 'pourcentage()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
  },
})
export class ReadingProgressBar {
  /** 0.0 → 1.0, comme côté Flutter. */
  readonly progress = input.required<number>();
  readonly showLabel = input(true);
  readonly height = input(4);
  readonly color = input<string>();

  protected readonly pourcentage = computed(() =>
    Math.round(Math.min(1, Math.max(0, this.progress())) * 100),
  );

  protected readonly termine = computed(() => this.pourcentage() >= 100);

  protected readonly couleurBarre = computed(
    () => this.color() ?? (this.termine() ? 'var(--tertiary)' : 'var(--primary)'),
  );
}
