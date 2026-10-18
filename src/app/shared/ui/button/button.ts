import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bouton — traduction directe de `ElevatedButtonTheme`/`OutlinedButtonTheme`/
 * `TextButtonTheme` (`app_theme.dart`). Pleine largeur par défaut : c'est le
 * choix fait côté Flutter (`minimumSize: Size(double.infinity, 54)`), pas un
 * détail d'intégration — un bouton de connexion qui ne prend que la largeur
 * de son texte se voit, dans l'autre sens, sur un écran conçu pour l'autre.
 */
@Component({
  selector: 'button[nlButton], a[nlButton]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styleUrl: './button.scss',
  host: {
    '[class]': 'hostClasses()',
  },
})
export class Button {
  /** `primary` (rempli), `outline` (bordé) ou `text` (sans fond). */
  readonly variant = input<'primary' | 'outline' | 'text'>('primary');

  /** `md` = 54px (le défaut Flutter), `sm` = bouton secondaire compact. */
  readonly size = input<'md' | 'sm'>('md');

  /** Pleine largeur par défaut ; `false` pour un bouton à la taille de son contenu. */
  readonly fullWidth = input(true);

  protected hostClasses(): string {
    return [
      'nl-btn',
      `nl-btn--${this.variant()}`,
      `nl-btn--${this.size()}`,
      this.fullWidth() ? 'nl-btn--full' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
