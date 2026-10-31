import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icon-paths';

/** Le registre des teintes : une couleur de texte, un fond assorti. */
export type TonBadge =
  | 'neutre'
  | 'primaire'
  | 'cyan'
  | 'ambre'
  | 'emeraude'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'danger';

/**
 * Micro-badge.
 *
 * ## Ce qu'il remplace
 *
 * Les étiquettes étaient dessinées à la main dans chaque écran : un `<span>`,
 * une couleur, un rayon, et la même recette recopiée six fois avec six
 * valeurs légèrement différentes. D'où des pastilles qui ne se ressemblaient
 * pas d'un écran à l'autre, et l'impression d'ensemble que la refonte visait.
 *
 * ## La règle
 *
 * Un badge n'est pas un bouton. Il ne porte ni `role`, ni `tabindex`, ni
 * taille minimale de cible : c'est une étiquette, et l'annoncer comme
 * cliquable trompait autant les lecteurs d'écran que la règle des 48 px
 * étirait les cartes qui les contiennent.
 *
 * Forme de stade, toujours : c'est ce qui le détache de la carte qui le
 * porte, dont les coins sont à peine arrondis.
 */
@Component({
  selector: 'nl-badge',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (icone(); as nom) {
      <nl-icon [name]="nom" [size]="12" />
    }
    <span class="nl-badge__texte"><ng-content /></span>
  `,
  styleUrl: './badge.scss',
  host: {
    '[class]': 'classes()',
    '[style.--badge-teinte]': 'teinte()',
    '[style.--badge-fond]': 'fond()',
  },
})
export class Badge {
  readonly ton = input<TonBadge>('neutre');
  readonly icone = input<IconName>();
  /** Teinte libre, pour un type de document servi par le domaine. */
  readonly couleur = input<string>();
  /** Fond libre associé à cette teinte. */
  readonly couleurFond = input<string>();
  /** Version pleine : fond saturé, texte renversé. Pour un état actif. */
  readonly pleine = input(false);
  /** Capitales et interlettrage ouvert — pour « CORRIGÉ », « L3 », « S1 ». */
  readonly capitales = input(false);

  protected readonly classes = computed(() => {
    const parties = ['nl-badge', `nl-badge--${this.ton()}`];
    if (this.pleine()) parties.push('nl-badge--pleine');
    if (this.capitales()) parties.push('nl-badge--capitales');
    return parties.join(' ');
  });

  protected readonly teinte = computed(() => this.couleur() ?? null);
  protected readonly fond = computed(() => this.couleurFond() ?? null);
}
