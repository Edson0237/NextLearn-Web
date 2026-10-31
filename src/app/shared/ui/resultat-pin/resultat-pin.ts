import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * L'écran qui dit ce qu'est devenue la saisie d'un PIN.
 *
 * Avant lui, un PIN juste faisait simplement changer d'écran et un PIN faux
 * vidait les points en laissant une ligne rouge sous le pavé : rien ne
 * confirmait qu'on avait bien été reconnu, rien ne disait clairement qu'on
 * avait échoué.
 *
 * - **succès** : une coche, un mot, et on continue seul après un court instant
 *   (touchable pour passer tout de suite) — assez long pour être lu, assez
 *   court pour ne pas retarder l'étudiant ;
 * - **échec** : le motif, et un bouton pour recommencer. Pas de disparition
 *   automatique : un message d'erreur qu'on n'a pas le temps de lire est pire
 *   que pas de message.
 *
 * Plein écran et au-dessus de tout : le pavé ne doit plus recevoir de touche
 * pendant qu'on lit le résultat.
 */
@Component({
  selector: 'nl-resultat-pin',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="nl-res"
      [class.nl-res--succes]="etat() === 'succes'"
      [class.nl-res--echec]="etat() === 'echec'"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-live]="etat() === 'echec' ? 'assertive' : 'polite'"
      (click)="etat() === 'succes' && termine.emit()">
      <span class="nl-res__pastille" aria-hidden="true">
        <nl-icon [name]="etat() === 'succes' ? 'check_circle' : 'error'" [size]="56" />
      </span>
      <h2 class="nl-res__titre">{{ titre() }}</h2>
      @if (message()) {
        <p class="nl-res__message">{{ message() }}</p>
      }
      @if (etat() === 'echec') {
        <button type="button" class="nl-res__action" (click)="reessayer.emit()">{{ libelleAction() }}</button>
        @if (libelleSecondaire()) {
          <button type="button" class="nl-res__lien" (click)="secondaire.emit()">{{ libelleSecondaire() }}</button>
        }
      }
    </div>
  `,
  styleUrl: './resultat-pin.scss',
})
export class ResultatPin implements OnInit {
  readonly etat = input.required<'succes' | 'echec'>();
  readonly titre = input.required<string>();
  readonly message = input<string>('');
  readonly libelleAction = input('Réessayer');
  readonly libelleSecondaire = input('');
  /** Délai avant de continuer seul après un succès. */
  readonly delaiMs = input(1400);

  readonly termine = output<void>();
  readonly reessayer = output<void>();
  readonly secondaire = output<void>();

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (this.etat() !== 'succes') return;
    const minuteur = setTimeout(() => this.termine.emit(), this.delaiMs());
    this.destroyRef.onDestroy(() => clearTimeout(minuteur));
  }
}
