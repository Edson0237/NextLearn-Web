import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * L'habillage commun à toute feuille — traduction de `_Coque`
 * (`feuille_action.dart`) : coins arrondis en haut, poignée décorative,
 * marge basse pour l'indicateur d'accueil iOS, et place laissée au
 * clavier quand il s'ouvre sur un champ de la feuille.
 *
 * La poignée est purement décorative (`aria-hidden`) : elle ne doit pas
 * être annoncée, même raison que `ExcludeSemantics` côté Flutter.
 */
@Component({
  selector: 'nl-bottom-sheet-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-sheet-shell.html',
  styleUrl: './bottom-sheet-shell.scss',
})
export class BottomSheetShell {
  readonly title = input<string>();
}
