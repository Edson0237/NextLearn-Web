import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ElementIcone, ICON_PATHS, IconName } from './icon-paths';

/**
 * Une icône du registre (`icon-paths.ts`, Lucide).
 *
 * Dessinée au trait : 24 px de repère, épaisseur 1,75, extrémités arrondies,
 * `currentColor` — elle prend donc la couleur du texte qui l'entoure, et c'est
 * l'écran qui décide de sa teinte. Selon la définition, un remplissage `plein`
 * (marque-page, étoile, cœur, dossier) ou `doux` (teinte translucide sous le
 * trait, pour l'onglet courant).
 */
@Component({
  selector: 'nl-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="remplissage()"
      [attr.fill-opacity]="opaciteRemplissage()"
      stroke="currentColor"
      [attr.stroke-width]="epaisseur()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      @for (el of elements(); track $index) {
        @switch (el.t) {
          @case ('path') { <svg:path [attr.d]="el['d']" /> }
          @case ('circle') { <svg:circle [attr.cx]="el['cx']" [attr.cy]="el['cy']" [attr.r]="el['r']" /> }
          @case ('rect') {
            <svg:rect [attr.x]="el['x']" [attr.y]="el['y']" [attr.width]="el['width']" [attr.height]="el['height']" [attr.rx]="el['rx']" [attr.ry]="el['ry']" />
          }
          @case ('line') { <svg:line [attr.x1]="el['x1']" [attr.y1]="el['y1']" [attr.x2]="el['x2']" [attr.y2]="el['y2']" /> }
          @case ('polyline') { <svg:polyline [attr.points]="el['points']" /> }
          @case ('polygon') { <svg:polygon [attr.points]="el['points']" /> }
          @case ('ellipse') { <svg:ellipse [attr.cx]="el['cx']" [attr.cy]="el['cy']" [attr.rx]="el['rx']" [attr.ry]="el['ry']" /> }
        }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);

  private readonly definition = computed(() => ICON_PATHS[this.name()] as { f: 'plein' | 'doux' | null; e: readonly ElementIcone[] } | undefined);

  protected readonly elements = computed(() => this.definition()?.e ?? []);
  protected readonly remplissage = computed(() => (this.definition()?.f ? 'currentColor' : 'none'));
  protected readonly opaciteRemplissage = computed(() => (this.definition()?.f === 'doux' ? 0.16 : null));
  /** Un trait un peu plus fin aux grandes tailles, plus ferme aux petites : la même finesse à l'œil. */
  protected readonly epaisseur = computed(() => (this.size() >= 40 ? 1.5 : this.size() <= 16 ? 2 : 1.75));
}
