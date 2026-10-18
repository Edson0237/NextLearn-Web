import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Illustration } from '../illustration/illustration';
import { Button } from '../button/button';

/**
 * Ce qu'on montre quand le premier démarrage ne trouve pas internet —
 * traduction d'`EcranSansConnexion` (`ecran_sans_connexion.dart`).
 *
 * `retrying` est une entrée, pas un état interne : côté Flutter, le
 * callback `onReessayer` est un `Future<bool> Function()` que le widget
 * attend lui-même. Un `output()` Angular ne se « attend » pas — c'est
 * donc l'appelant qui pilote la vérification réseau et reflète son état
 * ici, plutôt que ce composant qui prétendrait gérer une promesse qu'il
 * ne reçoit jamais réellement.
 */
@Component({
  selector: 'nl-offline-screen',
  standalone: true,
  imports: [Illustration, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-screen.html',
  styleUrl: './offline-screen.scss',
})
export class OfflineScreen {
  readonly retrying = input(false);
  /** Proposé seulement s'il y a quelque chose à voir hors ligne. */
  readonly canContinueAnyway = input(false);

  readonly retry = output<void>();
  readonly continueAnyway = output<void>();
}
