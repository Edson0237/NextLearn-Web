import { Injectable } from '@angular/core';

/**
 * La route à ouvrir une fois la voie libre — traduction de
 * `_destinationEnAttente`/`_consommerDestination` (`app_router.dart`).
 *
 * Conservée en mémoire seulement, comme côté Flutter : la faire survivre
 * à une fermeture de l'application rouvrirait un jour une fiche que plus
 * personne n'attend.
 */
@Injectable({ providedIn: 'root' })
export class PendingDestinationService {
  private valeur: string | null = null;

  set(chemin: string): void {
    this.valeur = chemin;
  }

  /** Relue une seule fois : la laisser en place rendrait cette fiche
   * impossible à quitter, chaque navigation y ramenant. */
  consommer(): string | null {
    const v = this.valeur;
    this.valeur = null;
    return v;
  }
}
