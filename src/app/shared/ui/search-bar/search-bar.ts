import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { TraductionPipe } from '../../../core/i18n';

/**
 * Barre de recherche.
 *
 * ## Deux usages, un composant
 *
 * Sur l'accueil elle ne cherche pas : elle **ouvre** l'écran de recherche.
 * Dans la bibliothèque elle filtre à la frappe. La différence tient à
 * `lectureSeule` : dans ce mode, tout le champ devient un bouton, et le
 * clavier ne s'ouvre jamais pour rien.
 *
 * ## Le bouton d'effacement
 *
 * Il n'apparaît qu'une fois quelque chose saisi. Toujours visible, il occupe
 * la place d'un bouton qui ne sert à rien neuf fois sur dix ; absent, il
 * oblige à effacer caractère par caractère.
 */
@Component({
  selector: 'nl-search-bar',
  standalone: true,
  imports: [Icon, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
})
export class SearchBar {
  readonly valeur = model('');
  readonly placeholder = input('');
  /** Le champ n'est pas saisissable : il ouvre l'écran de recherche. */
  readonly lectureSeule = input(false);
  /** Affiche le bouton de filtres à droite. */
  readonly avecFiltres = input(false);
  /** Nombre de filtres actifs, pour la pastille du bouton. */
  readonly filtresActifs = input(0);

  readonly ouvrir = output<void>();
  readonly filtrer = output<void>();

  protected surSaisie(evenement: Event): void {
    this.valeur.set((evenement.target as HTMLInputElement).value);
  }

  protected effacer(evenement: Event): void {
    evenement.stopPropagation();
    this.valeur.set('');
  }
}
