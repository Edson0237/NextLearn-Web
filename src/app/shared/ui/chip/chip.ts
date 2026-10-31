import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Puce de filtre - traduction de `DocumentTypeChip`/`FilterChipRow`
 * (`lib/shared/widgets/category_chip.dart`). Sélectionnée : remplie de sa
 * couleur, texte blanc. Non sélectionnée : la même couleur à 10 %, texte
 * coloré - exactement `_color.withAlpha(25)` côté Flutter (25/255 ≈ 0.10).
 *
 * La couleur se passe en valeur CSS (`color="var(--type-cours)"` ou tout
 * hex), pas en nom de type : ce composant ne connaît pas le vocabulaire
 * métier (types de document, matières...), il ne fait que la puce.
 */
@Component({
  selector: 'nl-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styleUrl: './chip.scss',
  host: {
    // `role="button"` n'est plus posé d'office. Les deux seuls usages réels
    // sont des étiquettes de type sur une carte : elles ne se tapent pas, et
    // les annoncer comme des boutons trompait les lecteurs d'écran autant que
    // la règle de taille minimale, qui étirait chaque étiquette à 48 px de
    // haut au milieu d'une carte.
    '[attr.role]': "interactive() ? 'button' : null",
    '[attr.tabindex]': 'interactive() ? 0 : null',
    '[class.nl-chip--selected]': 'selected()',
    '[class.nl-chip--compact]': 'compact()',
    '[style.--chip-color]': 'color()',
  },
})
export class Chip {
  readonly selected = input(false);
  /** Puce réellement tapable (filtre) plutôt que simple étiquette. */
  readonly interactive = input(false);
  readonly compact = input(false);
  /** N'importe quelle couleur CSS valide : hex, `var(--type-cours)`, etc. */
  readonly color = input<string>('var(--primary)');
}
