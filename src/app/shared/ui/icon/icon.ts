import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icon-paths';

/**
 * Une icône Material Symbols, dessinée en SVG inline — voir
 * `icon-paths.ts` pour pourquoi un tracé plutôt qu'une police.
 *
 * `currentColor` par défaut : l'icône suit la couleur du texte qui
 * l'entoure, exactement comme `Icon(..., color: ...)` côté Flutter —
 * poser la couleur sur un ancêtre suffit, pas besoin de la répéter ici.
 */
@Component({
  selector: 'nl-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path [attr.d]="chemin()" />
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);

  protected chemin(): string {
    return ICON_PATHS[this.name()] ?? '';
  }
}
