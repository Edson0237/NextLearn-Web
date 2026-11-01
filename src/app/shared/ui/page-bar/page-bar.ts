import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { TraductionPipe } from '../../../core/i18n';

/**
 * La barre des écrans secondaires : retour, titre, actions.
 *
 * ## Pourquoi un composant partagé
 *
 * Chaque écran dessinait la sienne, et aucune ne ressemblait aux autres :
 * un bandeau dégradé pleine largeur qui mangeait le tiers de l'écran sur le
 * profil et la fiche épreuve, une barre plate de 40 px sur les sessions, un
 * libellé en capitales sur la fiche ressource et un titre normal sur la
 * bibliothèque hors-ligne. Le bouton retour lui-même changeait de taille
 * d'un écran à l'autre - 40 px ici, 48 px là.
 *
 * Le bandeau dégradé a été abandonné sur la fiche ressource pour une raison
 * qui vaut pour tous : il coûtait un tiers de la hauteur utile pour répéter
 * un titre, et imposait un texte clair que les teintes pâles du thème
 * sombre ne portaient pas.
 *
 * ## Le fond translucide
 *
 * Même raison que sur `nl-app-header` : la barre reste au-dessus du contenu
 * qui défile dessous. Sans fond, les cartes lui passeraient au travers ;
 * opaque, elle ferait un bloc posé sur la page.
 */
@Component({
  selector: 'nl-page-bar',
  standalone: true,
  imports: [Icon, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="nl-barre">
      <button
        type="button"
        class="nl-barre__rond"
        [attr.aria-label]="'actionRetour' | t"
        (click)="retour.emit()">
        <nl-icon name="arrow_back" [size]="20" />
      </button>

      <h1 class="nl-barre__titre">{{ titre() }}</h1>

      <!-- Les actions de droite, posées par l'écran : partager, signaler,
           synchroniser. Le conteneur existe toujours pour que le titre
           reste à la même place d'un écran à l'autre, avec ou sans. -->
      <div class="nl-barre__actions">
        <ng-content />
      </div>
    </header>
  `,
  styleUrl: './page-bar.scss',
})
export class PageBar {
  readonly titre = input.required<string>();
  readonly retour = output<void>();
}
