import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icon-paths';

/**
 * Tête de section : un titre, parfois une pastille, parfois une action.
 *
 * Chaque écran dessinait la sienne — un `h2`, un bouton, un `justify-content`
 * — avec des tailles et des espacements qui ne concordaient pas. C'est le
 * genre d'écart qu'on ne voit pas en écrivant un écran, et qui se voit en
 * les faisant défiler.
 *
 * La pastille d'icône à gauche n'est pas décorative : elle donne à la section
 * la même ancre visuelle que les cartes qu'elle introduit, et c'est ce qui
 * fait tenir une page longue.
 */
@Component({
  selector: 'nl-section-header',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-section">
      <div class="nl-section__gauche">
        @if (icone(); as nom) {
          <span class="nl-section__pastille" [style.--teinte]="teinte()">
            <nl-icon [name]="nom" [size]="16" />
          </span>
        }
        <div class="nl-section__textes">
          <h2 class="nl-section__titre">{{ titre() }}</h2>
          @if (sousTitre()) {
            <p class="nl-section__sous-titre">{{ sousTitre() }}</p>
          }
        </div>
      </div>

      @if (action()) {
        <button type="button" class="nl-section__action nl-cible-fine" (click)="agir.emit()">
          {{ action() }}
        </button>
      }
    </div>
  `,
  styleUrl: './section-header.scss',
})
export class SectionHeader {
  readonly titre = input.required<string>();
  readonly sousTitre = input<string>();
  readonly icone = input<IconName>();
  /** Teinte de la pastille. Cobalt par défaut. */
  readonly teinte = input('var(--primary)');
  readonly action = input<string>();

  readonly agir = output<void>();
}
