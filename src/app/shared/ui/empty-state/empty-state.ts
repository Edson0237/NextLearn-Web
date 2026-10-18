import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '../button/button';

/**
 * Écran sans contenu, mais jamais sans issue — traduction de `EmptyState`
 * (`lib/shared/widgets/empty_state.dart`). Badge circulaire à 10 % de la
 * couleur (icône au centre), titre, sous-titre, bouton d'action optionnel.
 *
 * L'icône se passe par projection (`ng-content` nommé) plutôt que par une
 * énumération fermée comme côté Flutter (`IllustrationVide`) : le web n'a
 * pas le même risque de chemin de fichier qui se casse silencieusement
 * (`Image.asset` échoue à l'exécution côté Flutter ; ici, un composant
 * d'icône absent serait une erreur de compilation TypeScript).
 */
@Component({
  selector: 'nl-empty-state',
  standalone: true,
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly ctaLabel = input<string>();
  readonly cta = output<void>();
}
