import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';

/**
 * La mention sous les boutons d'inscription et de connexion : s'inscrire ou se
 * connecter vaut acceptation de la politique de confidentialité et des
 * conditions d'utilisation. Les liens s'ouvrent dans un autre onglet : lire un
 * document ne fait perdre ni l'adresse saisie ni le PIN en cours.
 */
@Component({
  selector: 'nl-mentions-legales',
  standalone: true,
  imports: [TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="nl-mentions">
      {{ 'mentionsDebut' | t }}<a href="/confidentialite/" target="_blank" rel="noopener">{{ 'consentPolitiqueNom' | t }}</a>{{ 'consentEtLes' | t }}<a href="/conditions/" target="_blank" rel="noopener">{{ 'consentConditionsNom' | t }}</a>.
    </p>
  `,
  styles: [`
    .nl-mentions { margin: 0; text-align: center; font: 400 0.8125rem/1.5 var(--font-family-body); color: var(--text-muted); }
    .nl-mentions a { color: var(--primary); font-weight: 600; text-decoration: underline; }
  `],
})
export class MentionsLegales {}
