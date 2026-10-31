import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Avatar } from '../avatar/avatar';

/**
 * Le rond d'identité des écrans d'authentification.
 *
 * Trois états, dans cet ordre de préférence : **la photo** de l'étudiant si
 * le compte en porte une, **ses initiales** sinon, et **la marque NextLearn**
 * quand on ne sait pas encore qui se présente.
 *
 * Le repli était « NL » en toutes lettres sur `unlock` comme sur
 * `login-pin` : deux lettres qui ne disaient rien à quelqu'un qui venait de
 * voir la toque du splash, et qui masquaient la photo même lorsqu'elle
 * existait - les deux écrans dessinaient leur rond à la main et ne
 * regardaient jamais `avatarUrl`.
 *
 * `nl-avatar` porte déjà le repli photo → initiales, y compris le retour aux
 * initiales quand l'image échoue à charger. Ce composant ne lui ajoute que
 * le troisième état et la mise en page commune aux deux écrans.
 */
@Component({
  selector: 'nl-identite',
  standalone: true,
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connu()) {
      <nl-avatar
        [initials]="initiales()"
        [photoUrl]="photoUrl()"
        [size]="taille()"
        [onDarkBackground]="false" />
    } @else {
      <img
        class="nl-identite__marque"
        src="/images/logo-marque.png"
        alt=""
        aria-hidden="true"
        [width]="taille()"
        [height]="taille()" />
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .nl-identite__marque {
        border-radius: 50%;
        object-fit: cover;
      }
    `,
  ],
})
export class Identite {
  /** Les initiales, déjà calculées par l'appelant qui connaît le modèle. */
  readonly initiales = input<string>('');
  readonly photoUrl = input<string>();
  readonly taille = input(84);

  /** Vrai dès qu'on sait qui se présente : initiales ou photo. */
  protected readonly connu = computed(
    () => !!this.photoUrl() || this.initiales().trim().length > 0,
  );
}
