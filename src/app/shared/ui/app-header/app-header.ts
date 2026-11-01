import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NotificationsEtat } from '../../../core/notifications';
import { Icon } from '../icon/icon';
import { Avatar } from '../avatar/avatar';
import { TraductionPipe } from '../../../core/i18n';

/**
 * L'en-tête de l'application.
 *
 * ## Pourquoi un composant partagé
 *
 * Chaque écran dessinait sa propre barre : un bouton retour ici, un titre
 * là, une cloche sur l'accueil seulement. Rien n'identifiait l'application
 * d'un écran à l'autre, et c'est l'une des choses qui faisaient « page web »
 * plutôt qu'application.
 *
 * Il porte trois informations, dans cet ordre de lecture :
 *
 * 1. **où l'on est** - le nom du produit, puis la section en capitales ;
 * 2. **ce qui a changé** - la cloche, avec un point tant qu'il reste des
 *    notifications non lues ;
 * 3. **qui l'on est** - l'avatar, et juste en dessous le cursus actif, qui
 *    détermine tout ce que l'écran affiche.
 *
 * ## Le fond translucide
 *
 * L'en-tête reste au-dessus du contenu qui défile dessous. Sans fond, les
 * cartes lui passeraient au travers ; opaque, il ferait un bloc posé sur la
 * page. Le flou d'arrière-plan laisse deviner le défilement sans gêner la
 * lecture - et retombe sur un fond plein là où il n'est pas pris en charge.
 */
@Component({
  selector: 'nl-app-header',
  standalone: true,
  imports: [Icon, Avatar, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
})
export class AppHeader {
  /** La section, affichée en capitales sous le nom du produit. */
  readonly section = input.required<string>();
  readonly prenom = input<string>();
  readonly nom = input<string>();
  readonly avatarUrl = input<string>();

  /** Le cursus actif : école et niveau. Masqué s'il n'est pas connu. */
  readonly contexte = input<string>();

  /**
   * Le compte vient du service, plus d'un écran.
   *
   * Seul l'accueil le passait, et il ne le rafraîchissait jamais : la
   * pastille restait allumée après lecture, et les quatre autres onglets
   * n'en avaient pas du tout. Chaque en-tête lit désormais la même source.
   */
  private readonly etat = inject(NotificationsEtat);
  protected readonly nonLues = this.etat.nonLues;

  constructor() {
    void this.etat.rafraichir();
  }

  /** Au-delà, le compte exact n'apporte plus rien. */
  protected readonly plafond = 99;

  readonly favoris = output<void>();
  readonly notifications = output<void>();
  readonly profil = output<void>();
  readonly changerContexte = output<void>();

  protected readonly badge = computed(() => {
    const n = this.nonLues();
    if (n <= 0) return null;
    return n > this.plafond ? `${this.plafond}+` : String(n);
  });

  protected readonly initiales = computed(() => {
    const p = (this.prenom() ?? '').trim();
    const n = (this.nom() ?? '').trim();
    return `${p.charAt(0)}${n.charAt(0)}`.toUpperCase() || '?';
  });
}
