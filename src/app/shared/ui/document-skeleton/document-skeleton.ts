import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Skeleton } from '../skeleton/skeleton';

/**
 * Le squelette d'une carte document — calque de `DocumentCard`, traduction
 * de `SqueletteDocumentCard` (`squelette_document.dart`).
 *
 * Reprend la disposition réelle (même tuile, mêmes lignes de titre, même
 * rangée de métadonnées) plutôt qu'un rectangle gris : l'arrivée des
 * données ne fait alors que remplir des formes déjà en place, sans
 * recomposer la page sous les yeux. C'est pour cela que ce fichier vit à
 * côté de `document-card` : les deux doivent évoluer ensemble.
 */
@Component({
  selector: 'nl-document-skeleton',
  standalone: true,
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-skeleton.html',
  styleUrl: './document-skeleton.scss',
  host: {
    role: 'status',
    'aria-label': 'Chargement des documents',
    '[class.nl-doc-skel--horizontal]': 'horizontal()',
  },
})
export class DocumentSkeleton {
  readonly horizontal = input(false);
}
