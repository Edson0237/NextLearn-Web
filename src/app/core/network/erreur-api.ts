import { HttpErrorResponse } from '@angular/common/http';
import { isDevMode } from '@angular/core';
import { Failure } from '../models/failure.model';

/**
 * Traduit ce qu'un appel réseau a levé en `Failure`, le seul type d'erreur que
 * les écrans savent lire.
 *
 * Une réponse HTTP en erreur garde son statut et son code ; tout autre échec
 * (réseau coupé avant réponse, bug) devient un message générique. Les
 * messages bruts du serveur ne sont pas exposés en production - voir
 * `Failure.depuisErreurHttp`.
 *
 * Une seule définition, utilisée par tous les dépôts de données : ils en
 * portaient chacun une copie identique.
 */
export function enFailure(e: unknown): Failure {
  if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, !isDevMode());
  return new Failure('Une erreur est survenue.');
}
