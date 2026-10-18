import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';

/**
 * Ce qui s'affiche quand le rendu d'un écran a échoué — traduction
 * d'`EcranErreurFatale` (`ecran_erreur_fatale.dart`).
 *
 * Volontairement présentationnel, sans la pièce qui l'installe comme
 * filet de sécurité global côté Flutter (`installerFiletErreurs`,
 * `ErrorWidget.builder`). L'équivalent web est `ErrorHandler`
 * (`@angular/core`), qui se branche au niveau de l'application entière —
 * une décision d'architecture globale, Phase 3, pas un composant de
 * présentation. Ce composant est la pièce que ce futur handler affichera.
 *
 * La trace ne se déplie qu'en développement (`showDetails`), jamais en
 * production : elle n'a aucun sens pour un étudiant et peut nommer des
 * chemins internes — même raison que `kDebugMode` côté Flutter.
 */
@Component({
  selector: 'nl-fatal-error',
  standalone: true,
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fatal-error.html',
  styleUrl: './fatal-error.scss',
})
export class FatalError {
  readonly canGoBack = input(false);
  readonly showDetails = input(false);
  readonly details = input<string>();

  readonly back = output<void>();

  protected readonly detailsVisibles = signal(false);
}
