import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Consentements } from '../../../core/auth';
import { TraductionPipe } from '../../../core/i18n';

/**
 * Les deux cases d'acceptation des documents juridiques, décochées par défaut.
 *
 * Les liens s'ouvrent dans un autre onglet : lire un document ne fait perdre
 * ni l'adresse saisie ni le PIN en cours. Le composant ne décide de rien : il
 * renseigne `Consentements`, et le serveur vérifie.
 */
@Component({
  selector: 'nl-consentements',
  standalone: true,
  imports: [TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-cons" role="group" [attr.aria-label]="'consentTitre' | t">
      <label class="nl-cons__ligne">
        <input type="checkbox" [checked]="cons.confidentialite()" (change)="cocher('confidentialite', $event)" />
        <span>
          {{ 'consentJAccepte' | t }}
          <a href="/confidentialite/" target="_blank" rel="noopener">{{ 'consentPolitiqueNom' | t }}</a>.
        </span>
      </label>
      <label class="nl-cons__ligne">
        <input type="checkbox" [checked]="cons.conditions()" (change)="cocher('conditions', $event)" />
        <span>
          {{ 'consentJAccepte' | t }}
          <a href="/conditions/" target="_blank" rel="noopener">{{ 'consentConditionsNom' | t }}</a>.
        </span>
      </label>
      @if (afficherRappel() && !cons.toutCoche()) {
        <p class="nl-cons__rappel" role="alert">{{ 'consentRappel' | t }}</p>
      }
    </div>
  `,
  styles: [`
    .nl-cons { display: flex; flex-direction: column; gap: 10px; text-align: left; }
    .nl-cons__ligne { display: flex; gap: 10px; align-items: flex-start; font: 400 0.875rem/1.45 var(--font-family-body); color: var(--text-secondary); cursor: pointer; }
    .nl-cons__ligne input { flex: none; width: 20px; height: 20px; margin-top: 1px; accent-color: var(--primary); }
    .nl-cons__ligne a { color: var(--primary); font-weight: 600; }
    .nl-cons__rappel { margin: 0; font: 500 0.8125rem/1.4 var(--font-family-body); color: var(--danger); }
  `],
})
export class ConsentementsCases {
  protected readonly cons = inject(Consentements);
  /** Montre le rappel « accepte les deux pour continuer » (après une tentative). */
  readonly afficherRappel = input(false);

  protected cocher(document: 'confidentialite' | 'conditions', e: Event): void {
    this.cons.definir(document, (e.target as HTMLInputElement).checked);
  }
}
