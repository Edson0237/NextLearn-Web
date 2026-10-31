import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppRoutes } from '../../core/router/app-routes';

/**
 * Point d'arrivée d'un lien partagé `/d/<id>`.
 *
 * Il ne fait que traduire l'adresse publique en route interne et s'efface :
 * la garde d'authentification prend le relais - elle mémorise la fiche
 * demandée si personne n'est connecté, et y revient une fois la session
 * ouverte (`PendingDestinationService`), exactement comme
 * `_destinationEnAttente` côté Flutter.
 *
 * `replaceUrl` : sans lui, revenir en arrière depuis la fiche repasserait par
 * cette redirection et rouvrirait la fiche - une impasse dont on ne sort
 * qu'en fermant l'onglet.
 */
@Component({
  selector: 'nl-redirection-document',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class RedirectionDocument {
  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const id = route.snapshot.paramMap.get('id') ?? '';
    const cible = id ? `/app/${AppRoutes.docDetailPath(id)}` : '/app';
    void router.navigateByUrl(cible, { replaceUrl: true });
  }
}
